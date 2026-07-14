import { useState, useMemo, useEffect } from 'react';
import type { InventoryItem } from './types';
import { getTodayString } from './utils/date';
import { ItemCard } from './components/ItemCard';
import { Modal } from './components/Modal';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import type { Session } from '@supabase/supabase-js';
import logo from './assets/logo.png';

interface DbBorrowRecord {
  id: string | number;
  item_id: string;
  borrowed_by: string;
  quantity: number;
  borrowed_date: string;
  status: 'Borrowed' | 'Returned';
  notes: string;
  returned_date?: string | null;
}

interface DbItem {
  id: string | number;
  name: string;
  description?: string | null;
  total_quantity: number;
  borrow_records?: DbBorrowRecord[];
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function App() {
  // --- Auth States ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- States ---
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning' | 'danger' }[]>([]);

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // --- Listen for Auth Session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setAuthLoading(false);
    }).catch((err) => {
      console.error("Error fetching initial session:", err);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // --- Fetch items from Supabase ---
  useEffect(() => {
    if (!session) return;

    let active = true;

    const fetchItems = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchErr } = await supabase
          .from('items')
          .select('*, borrow_records(*)')
          .order('name', { ascending: true });

        if (fetchErr) throw fetchErr;

        if (!active) return;

        const mappedItems: InventoryItem[] = (data || []).map((dbItem: DbItem) => {
          const dbBorrows = dbItem.borrow_records || [];

          // Calculate borrowed quantity from borrow_records:
          // SUM(quantity) WHERE status = 'Borrowed'
          const borrowedQty = dbBorrows
            .filter((r) => r.status === 'Borrowed')
            .reduce((sum, r) => sum + r.quantity, 0);

          const totalQty = dbItem.total_quantity;
          const finalBorrowedQty = Math.min(borrowedQty, totalQty);
          const finalAvailQty = totalQty - finalBorrowedQty;

          // Map borrows to the format required by the UI/types
          const mappedBorrows = dbBorrows.map((r) => ({
            id: String(r.id),
            borrowedBy: r.borrowed_by,
            quantity: r.quantity,
            borrowDate: r.borrowed_date,
            status: r.status,
            notes: r.notes || '',
            returnDate: r.returned_date || undefined,
          }));

          return {
            id: String(dbItem.id),
            name: dbItem.name,
            description: dbItem.description || '',
            totalQuantity: totalQty,
            availableQuantity: finalAvailQty,
            borrowedQuantity: finalBorrowedQty,
            borrows: mappedBorrows,
          };
        });

        setItems(mappedItems);
      } catch (err: unknown) {
        console.error("Error fetching items:", err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch items';
        if (active) setError(errorMsg);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchItems();

    return () => {
      active = false;
    };
  }, [refreshTrigger, session]);

  // Modals controller states
  const [activeModal, setActiveModal] = useState<'add' | 'edit' | 'borrow' | 'return' | 'records' | 'delete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form Fields states
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemTotal, setItemTotal] = useState<number | ''>('');

  const [borrowBy, setBorrowBy] = useState('');
  const [borrowQty, setBorrowQty] = useState<number | ''>(1);
  const [borrowDate, setBorrowDate] = useState('');
  const [borrowNotes, setBorrowNotes] = useState('');

  // --- Toast Manager ---
  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'danger' = 'success') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // --- Derived State (useMemo) ---
  const stats = useMemo(() => {
    let totalQty = 0;
    let availQty = 0;
    let borrowedQty = 0;

    items.forEach((item) => {
      totalQty += item.totalQuantity || 0;
      availQty += item.availableQuantity || 0;
      borrowedQty += item.borrowedQuantity || 0;
    });

    return {
      itemTypes: items.length,
      totalQty,
      availQty,
      borrowedQty,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  // --- State Mutators ---

  // Add Item
  const addItem = async (name: string, description: string, totalQuantity: number) => {
    try {
      const { error: insertErr } = await supabase
        .from('items')
        .insert([{
          name,
          description,
          total_quantity: totalQuantity
        }]);

      if (insertErr) throw insertErr;

      showToast(`Item "${name}" registered successfully.`, 'success');
      triggerRefresh();
    } catch (err: unknown) {
      console.error("Error adding item:", err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to add item.';
      showToast(errorMsg, 'danger');
    }
  };

  // Edit Item
  const editItem = async (id: string, name: string, description: string, totalQuantity: number): Promise<boolean> => {
    const item = items.find((i) => i.id === id);
    if (!item) return false;

    if (totalQuantity < item.borrowedQuantity) {
      showToast(`Total quantity cannot be less than current borrowed units (${item.borrowedQuantity}).`, 'danger');
      return false;
    }

    try {
      const { error: updateErr } = await supabase
        .from('items')
        .update({
          name,
          description,
          total_quantity: totalQuantity
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      showToast(`Item "${name}" updated.`, 'info');
      triggerRefresh();
      return true;
    } catch (err: unknown) {
      console.error("Error updating item:", err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to update item.';
      showToast(errorMsg, 'danger');
      return false;
    }
  };

  // Delete Item
  const deleteItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      const { error: deleteErr } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      showToast(`"${item.name}" was deleted from inventory.`, 'danger');
      triggerRefresh();
    } catch (err: unknown) {
      console.error("Error deleting item:", err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete item.';
      showToast(errorMsg, 'danger');
    }
  };

  // Borrow Item
  const borrowItem = async (itemId: string, borrower: string, quantity: number, date: string, notes: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('borrow_records')
        .insert([{
          item_id: itemId,
          borrowed_by: borrower,
          quantity,
          borrowed_date: date,
          notes,
          status: 'Borrowed'
        }]);

      if (error) throw error;

      showToast("Equipment checked out successfully.", 'success');
      triggerRefresh();
      return true;
    } catch (err: unknown) {
      console.error("Error borrowing item:", err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to borrow item.';
      showToast(errorMsg, 'danger');
      return false;
    }
  };

  // Return Item
  const returnItem = async (borrowId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('borrow_records')
        .update({
          status: 'Returned',
          returned_date: getTodayString()
        })
        .eq('id', borrowId);

      if (error) throw error;

      showToast("Equipment returned successfully.", 'success');
      triggerRefresh();
      return true;
    } catch (err: unknown) {
      console.error("Error returning item:", err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to return item.';
      showToast(errorMsg, 'danger');
      return false;
    }
  };

  // --- Modal Triggers ---

  const openAddModal = () => {
    setItemName('');
    setItemDesc('');
    setItemTotal('');
    setSelectedItem(null);
    setActiveModal('add');
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setItemName(item.name);
    setItemDesc(item.description);
    setItemTotal(item.totalQuantity);
    setActiveModal('edit');
  };

  const openBorrowModal = (item: InventoryItem) => {
    if (item.availableQuantity <= 0) {
      showToast(`"${item.name}" is currently out of stock.`, 'warning');
      return;
    }
    setSelectedItem(item);
    setBorrowBy('');
    setBorrowQty(1);
    setBorrowDate(getTodayString());
    setBorrowNotes('');
    setActiveModal('borrow');
  };

  const openReturnModal = async (item: InventoryItem) => {
    setSelectedItem(item);
    setActiveModal('return');

    try {
      const { data, error: err } = await supabase
        .from('borrow_records')
        .select('*')
        .eq('item_id', item.id)
        .order('borrowed_date', { ascending: false });

      if (err) throw err;

      setSelectedItem((prev) =>
        prev
          ? {
            ...prev,
            borrows: (data || []).map((r) => ({
              id: String(r.id),
              borrowedBy: r.borrowed_by,
              quantity: r.quantity,
              borrowDate: r.borrowed_date,
              status: r.status,
              notes: r.notes || '',
              returnDate: r.returned_date || undefined,
            })),
          }
          : null
      );
    } catch (e: unknown) {
      console.error("Error loading return modal borrow records:", e);
      showToast("Failed to load active borrow records.", 'danger');
    }
  };

  const openRecordsModal = async (item: InventoryItem) => {
    setSelectedItem(item);
    setActiveModal('records');

    try {
      const { data, error: err } = await supabase
        .from('borrow_records')
        .select('*')
        .eq('item_id', item.id)
        .order('borrowed_date', { ascending: false });

      if (err) throw err;

      setSelectedItem((prev) =>
        prev
          ? {
            ...prev,
            borrows: (data || []).map((r) => ({
              id: String(r.id),
              borrowedBy: r.borrowed_by,
              quantity: r.quantity,
              borrowDate: r.borrowed_date,
              status: r.status,
              notes: r.notes || '',
              returnDate: r.returned_date || undefined,
            })),
          }
          : null
      );
    } catch (e: unknown) {
      console.error("Error loading borrow records modal:", e);
      showToast("Failed to load borrow history.", 'danger');
    }
  };

  const openDeleteModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setActiveModal('delete');
  };

  // --- Submit Handlers ---

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = itemName.trim();
    const trimmedDesc = itemDesc.trim();
    const parsedTotal = typeof itemTotal === 'number' ? itemTotal : parseInt(itemTotal, 10);

    if (!trimmedName || isNaN(parsedTotal) || parsedTotal < 0) return;

    if (activeModal === 'edit' && selectedItem) {
      const success = await editItem(selectedItem.id, trimmedName, trimmedDesc, parsedTotal);
      if (success) setActiveModal(null);
    } else {
      await addItem(trimmedName, trimmedDesc, parsedTotal);
      setActiveModal(null);
    }
  };

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const trimmedBorrower = borrowBy.trim();
    const parsedQty = typeof borrowQty === 'number' ? borrowQty : parseInt(borrowQty, 10);
    const trimmedNotes = borrowNotes.trim();

    if (!trimmedBorrower || isNaN(parsedQty) || parsedQty <= 0 || parsedQty > selectedItem.availableQuantity || !trimmedNotes) {
      return;
    }

    const success = await borrowItem(selectedItem.id, trimmedBorrower, parsedQty, borrowDate, trimmedNotes);
    if (success) {
      setActiveModal(null);
    }
  };

  const handleReturnRecord = async (borrowId: string) => {
    if (!selectedItem) return;

    const recordToReturn = selectedItem.borrows.find((b) => b.id === borrowId);
    if (!recordToReturn) return;

    const success = await returnItem(borrowId);
    if (success) {
      // Direct local update to refresh modal active listings in sync with async state
      setSelectedItem((prev) => {
        if (!prev) return null;
        const updatedBorrows = prev.borrows.map((b) => {
          if (b.id === borrowId) {
            return { ...b, status: 'Returned' as const, returnDate: getTodayString() };
          }
          return b;
        });

        const totalQty = prev.totalQuantity;
        const borrowedQty = updatedBorrows
          .filter((r) => r.status === 'Borrowed')
          .reduce((sum, r) => sum + r.quantity, 0);
        const finalBorrowedQty = Math.min(borrowedQty, totalQty);
        const finalAvailQty = totalQty - finalBorrowedQty;

        return {
          ...prev,
          availableQuantity: finalAvailQty,
          borrowedQuantity: finalBorrowedQty,
          borrows: updatedBorrows,
        };
      });

      // Auto close active return list modal if all borrowed stocks returned
      const newBorrowedQty = selectedItem.borrowedQuantity - recordToReturn.quantity;
      if (newBorrowedQty <= 0 && activeModal === 'return') {
        setActiveModal(null);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedItem) {
      await deleteItem(selectedItem.id);
      setActiveModal(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Robotics Club Logo" className="w-11 h-11 object-contain" />
            <h1 className="font-heading font-extrabold text-xl tracking-tight text-slate-900">Robotics Club</h1>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72 md:flex-none">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search items by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all"
              />
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-97 transition-all duration-150 whitespace-nowrap"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Item
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 active:scale-97 transition-all duration-150 whitespace-nowrap shadow-sm hover:shadow"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1">

        {/* STATS SECTION */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:translate-y-[-2px] transition-transform duration-200">
            <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold font-heading leading-tight">{stats.itemTypes}</div>
              <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Item Types</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:translate-y-[-2px] transition-transform duration-200">
            <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold font-heading leading-tight">{stats.totalQty}</div>
              <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Total Units</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:translate-y-[-2px] transition-transform duration-200">
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 11 11 13 15 9"></polyline>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold font-heading leading-tight">{stats.availQty}</div>
              <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Available Units</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm hover:translate-y-[-2px] transition-transform duration-200">
            <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="18" y1="8" x2="23" y2="13"></line>
                <line x1="23" y1="8" x2="18" y2="13"></line>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold font-heading leading-tight">{stats.borrowedQty}</div>
              <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Borrowed Units</div>
            </div>
          </div>
        </section>

        {/* INVENTORY LISTING */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-extrabold text-xl text-slate-900">Equipment Inventory</h2>
            {searchQuery && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-200/50 px-2.5 py-1 rounded-md">
                Showing {filteredItems.length} of {items.length} items
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center text-center p-16 bg-white border border-slate-200 rounded-xl max-w-lg mx-auto my-12 gap-4 shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-500">Loading equipment inventory...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center text-center p-16 bg-white border border-red-200 rounded-xl max-w-lg mx-auto my-12 gap-4 shadow-sm">
              <svg className="w-12 h-12 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div>
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-1">Failed to Load Inventory</h3>
                <p className="text-sm text-slate-500 max-w-[20rem] mx-auto leading-relaxed">{error}</p>
              </div>
              <button
                onClick={triggerRefresh}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-97 transition-all duration-150"
              >
                Try Again
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-16 bg-white border-2 border-dashed border-slate-200 rounded-xl max-w-lg mx-auto my-12 gap-5 shadow-sm">
              <svg className="w-16 h-16 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <div>
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-1">No Equipment Found</h3>
                <p className="text-sm text-slate-500 max-w-[20rem] mx-auto leading-relaxed">
                  No inventory items match your search term or inventory is currently empty. Try checking spelling or add a new item.
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-97 transition-all duration-150"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add First Item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onBorrow={openBorrowModal}
                  onReturn={openReturnModal}
                  onViewRecords={openRecordsModal}
                  onEdit={openEditModal}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-8 border-t border-slate-200 bg-white text-xs text-slate-400 font-medium">
        <p>Robotics Club &bull; Developed by <a href="https://github.com/HimalBhandari05/" target="_blank" rel="noopener noreferrer">Himal Bhandari</a></p>
      </footer>

      {/* MODALS */}

      {/* ADD / EDIT ITEM MODAL */}
      <Modal
        isOpen={activeModal === 'add' || activeModal === 'edit'}
        onClose={() => setActiveModal(null)}
        title={activeModal === 'add' ? 'Add New Item' : 'Edit Equipment Details'}
      >
        <form onSubmit={handleItemSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-900" htmlFor="item-name">Item Name *</label>
              <input
                type="text"
                id="item-name"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                placeholder="e.g., Arduino Uno R3"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-900" htmlFor="item-desc">Description</label>
              <textarea
                id="item-desc"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 min-h-[80px] transition-all"
                placeholder="Enter detailed specifications, location, or serial number..."
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-900" htmlFor="item-total">Total Quantity *</label>
              <input
                type="number"
                id="item-total"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                min="0"
                placeholder="e.g., 10"
                value={itemTotal}
                onChange={(e) => setItemTotal(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 active:scale-97 transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-97 transition-all duration-150"
            >
              {activeModal === 'add' ? 'Save Item' : 'Update Details'}
            </button>
          </div>
        </form>
      </Modal>

      {/* BORROW ITEM MODAL */}
      <Modal
        isOpen={activeModal === 'borrow'}
        onClose={() => setActiveModal(null)}
        title="Borrow Equipment"
      >
        {selectedItem && (
          <form onSubmit={handleBorrowSubmit}>
            <div className="px-6 py-5 space-y-4">
              <div>
                <div className="text-[0.725rem] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Equipment Item</div>
                <div className="text-base font-semibold text-slate-900 mb-3">{selectedItem.name}</div>

                <div className="text-[0.725rem] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Available to Borrow</div>
                <div className="text-base font-semibold text-slate-900 mb-3">{selectedItem.availableQuantity}</div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-900" htmlFor="borrow-by">Borrowed By *</label>
                <input
                  type="text"
                  id="borrow-by"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  placeholder="Full name of borrower"
                  value={borrowBy}
                  onChange={(e) => setBorrowBy(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-900" htmlFor="borrow-qty">Quantity *</label>
                <input
                  type="number"
                  id="borrow-qty"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  min="1"
                  max={selectedItem.availableQuantity}
                  placeholder="Quantity to borrow"
                  value={borrowQty}
                  onChange={(e) => setBorrowQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  required
                />
                {typeof borrowQty === 'number' && (borrowQty <= 0 || borrowQty > selectedItem.availableQuantity) && (
                  <div className="text-rose-600 text-[0.75rem] font-medium mt-1">
                    Quantity must be between 1 and {selectedItem.availableQuantity}.
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-900" htmlFor="borrow-date">Borrow Date *</label>
                <input
                  type="text"
                  id="borrow-date"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  placeholder="e.g., 13 July 2026"
                  value={borrowDate}
                  onChange={(e) => setBorrowDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-900" htmlFor="borrow-notes">Notes *</label>
                <textarea
                  id="borrow-notes"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 min-h-[80px] transition-all"
                  placeholder="e.g., Robot Competition, Workshop, Project development..."
                  value={borrowNotes}
                  onChange={(e) => setBorrowNotes(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 active:scale-97 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={typeof borrowQty === 'number' && (borrowQty <= 0 || borrowQty > selectedItem.availableQuantity)}
                className="inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-97 transition-all duration-150 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Confirm Borrow
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* RETURN ITEM MODAL */}
      <Modal
        isOpen={activeModal === 'return'}
        onClose={() => setActiveModal(null)}
        title="Return Equipment"
      >
        {selectedItem && (
          <div>
            <div className="px-6 py-5">
              <div className="text-[0.725rem] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Equipment Item</div>
              <div className="text-base font-semibold text-slate-900 mb-4">{selectedItem.name}</div>

              <div className="text-[0.725rem] uppercase tracking-wider text-slate-400 font-semibold mb-2.5">Active Borrow Records</div>
              <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
                {selectedItem.borrows.filter(r => r.status === 'Borrowed').length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No active borrow records found.</p>
                ) : (
                  selectedItem.borrows.filter(r => r.status === 'Borrowed').map(r => (
                    <div key={r.id} className="bg-slate-50 border border-slate-205 rounded-lg p-4 flex flex-col gap-2 relative">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{r.borrowedBy}</span>
                        <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-100 uppercase tracking-wider">Borrowed</span>
                      </div>
                      <div className="text-[0.8rem] text-slate-600 space-y-1">
                        <div><strong>Quantity:</strong> {r.quantity}</div>
                        <div><strong>Borrowed:</strong> {r.borrowDate}</div>
                        {r.notes && <div className="text-[0.75rem] italic text-slate-500 border-l-2 border-slate-200 pl-2 mt-1">Notes: "{r.notes}"</div>}
                      </div>
                      <button
                        onClick={() => handleReturnRecord(r.id)}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-97 shadow-sm"
                      >
                        Return Quantity
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="inline-flex items-center justify-center text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 active:scale-97 transition-all duration-150"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* VIEW BORROW RECORDS MODAL */}
      <Modal
        isOpen={activeModal === 'records'}
        onClose={() => setActiveModal(null)}
        title="Borrow Records"
        maxWidth="max-w-xl"
      >
        {selectedItem && (
          <div>
            <div className="px-6 py-5">
              <div className="text-[0.725rem] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Equipment Item</div>
              <div className="text-base font-semibold text-slate-900 mb-4">{selectedItem.name}</div>

              <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1">
                {selectedItem.borrows.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No borrow records found.</p>
                ) : (
                  selectedItem.borrows.map(r => {
                    const isBorrowed = r.status === 'Borrowed';
                    return (
                      <div key={r.id} className="bg-slate-50 border border-slate-202 rounded-lg p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">Borrowed by {r.borrowedBy}</span>
                          <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${isBorrowed
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                            {r.status}
                          </span>
                        </div>
                        <div className="text-[0.8rem] text-slate-600 space-y-1">
                          <div><strong>Quantity:</strong> {r.quantity}</div>
                          <div><strong>Date:</strong> {r.borrowDate}</div>
                          {r.returnDate && <div><strong>Returned:</strong> {r.returnDate}</div>}
                          {r.notes && <div className="text-[0.75rem] italic text-slate-500 border-l-2 border-slate-200 pl-2 mt-1">Notes: "{r.notes}"</div>}
                        </div>
                        {isBorrowed && (
                          <button
                            onClick={() => handleReturnRecord(r.id)}
                            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-97 shadow-sm"
                          >
                            Return Quantity
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="inline-flex items-center justify-center text-sm font-medium px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white active:scale-97 transition-all duration-150"
              >
                Close Records
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={activeModal === 'delete'}
        onClose={() => setActiveModal(null)}
        title="Confirm Deletion"
      >
        {selectedItem && (
          <div>
            <div className="px-6 py-5">
              <p className="font-medium text-slate-900 mb-1 text-sm">Are you sure you want to delete this item type?</p>
              <p className="text-sm text-slate-505 mb-4">Item Type: <strong className="text-slate-800">{selectedItem.name}</strong></p>
              <p className="text-xs text-red-650 font-semibold bg-red-50 border border-red-100 rounded-lg p-3.5 leading-relaxed shadow-sm">
                Warning: This action will permanently erase this equipment type and all of its associated borrowing history from local memory.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 active:scale-97 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="inline-flex items-center justify-center text-sm font-medium px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-97 transition-all duration-150"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* TOAST CONTAINER */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => {
          let borderColors = 'border-l-blue-600';
          let textColors = 'text-blue-600';
          let icon = null;

          if (toast.type === 'success') {
            borderColors = 'border-l-emerald-500';
            textColors = 'text-emerald-500';
            icon = <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
          } else if (toast.type === 'info') {
            borderColors = 'border-l-blue-600';
            textColors = 'text-blue-600';
            icon = <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
          } else if (toast.type === 'warning') {
            borderColors = 'border-l-amber-500';
            textColors = 'text-amber-500';
            icon = <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
          } else if (toast.type === 'danger') {
            borderColors = 'border-l-red-500';
            textColors = 'text-red-500';
            icon = <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto min-w-[280px] max-w-[400px] bg-white border border-slate-200 border-l-[4px] ${borderColors} p-3.5 rounded-lg shadow-xl flex items-center gap-3 text-sm text-slate-800`}
            >
              <span className={textColors}>{icon}</span>
              <span className="font-medium flex-1">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                aria-label="Close toast"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default App;

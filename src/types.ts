export interface BorrowRecord {
  id: string;
  borrowedBy: string;
  quantity: number;
  borrowDate: string;
  status: 'Borrowed' | 'Returned';
  notes: string;
  returnDate?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  totalQuantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  borrows: BorrowRecord[];
}

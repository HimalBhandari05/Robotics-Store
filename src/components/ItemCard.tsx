import React from 'react';
import type { InventoryItem } from '../types';

interface ItemCardProps {
  item: InventoryItem;
  onBorrow: (item: InventoryItem) => void;
  onReturn: (item: InventoryItem) => void;
  onViewRecords: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onBorrow,
  onReturn,
  onViewRecords,
  onEdit,
  onDelete,
}) => {
  const hasBorrowed = item.borrowedQuantity > 0;
  const isOutOfStock = item.availableQuantity === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all duration-300 hover:-translate-y-1">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-heading font-semibold text-lg text-slate-900 leading-snug break-words">
            {item.name}
          </h3>
        </div>
        <p className="text-sm text-slate-600 line-clamp-3 min-h-[3.8rem] overflow-hidden">
          {item.description || 'No description provided.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 my-1">
        <div className="flex flex-col items-center p-2 rounded-lg text-[0.75rem] font-medium border bg-slate-50 text-slate-900 border-slate-200">
          <span className="text-slate-500 mb-0.5 text-[0.7rem] uppercase tracking-wider">Total</span>
          <span className="text-lg font-bold font-heading">{item.totalQuantity}</span>
        </div>
        <div className={`flex flex-col items-center p-2 rounded-lg text-[0.75rem] font-medium border ${
          isOutOfStock 
            ? 'bg-red-50 text-red-600 border-red-150' 
            : 'bg-emerald-50 text-emerald-650 border-emerald-100'
        }`}>
          <span className="text-slate-500 mb-0.5 text-[0.7rem] uppercase tracking-wider">Available</span>
          <span className="text-lg font-bold font-heading">{item.availableQuantity}</span>
        </div>
        <div className={`flex flex-col items-center p-2 rounded-lg text-[0.75rem] font-medium border ${
          hasBorrowed 
            ? 'bg-amber-50 text-amber-800 border-amber-200' 
            : 'bg-slate-50 text-slate-400 border-slate-200'
        }`}>
          <span className="text-slate-500 mb-0.5 text-[0.7rem] uppercase tracking-wider">Borrowed</span>
          <span className="text-lg font-bold font-heading">{item.borrowedQuantity}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 mt-auto">
        <div className={`grid gap-2 ${hasBorrowed ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button 
            onClick={() => onBorrow(item)} 
            disabled={isOutOfStock}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-97 transition-all duration-150 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {isOutOfStock ? 'Out of Stock' : 'Borrow'}
          </button>
          {hasBorrowed && (
            <button 
              onClick={() => onReturn(item)}
              className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow active:scale-97 transition-all duration-150"
            >
              Return
            </button>
          )}
        </div>
        <div className="flex justify-between items-center mt-1">
          <button 
            onClick={() => onViewRecords(item)}
            className="inline-flex items-center justify-center gap-2 text-[0.75rem] font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 active:scale-97 transition-all duration-150 flex-1 mr-2"
          >
            View Borrow Records
          </button>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => onEdit(item)}
              title="Edit Item"
              className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 active:scale-97 transition-all duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button 
              onClick={() => onDelete(item)}
              title="Delete Item"
              className="p-2 rounded-lg text-slate-500 hover:text-red-650 hover:bg-red-50 border border-transparent hover:border-red-100 active:scale-97 transition-all duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

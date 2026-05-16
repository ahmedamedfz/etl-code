import React from 'react';

interface NodeHeaderProps {
  label: string;
  type: string;
  colorClass: string;
  darkColorClass: string;
  icon: string;
  onDelete: () => void;
}

export const NodeHeader = ({ label, type, colorClass, darkColorClass, icon, onDelete }: NodeHeaderProps) => (
  <div className={`${colorClass} px-3 py-2 flex items-center justify-between relative`}>
    <div className="flex items-center gap-2">
      <i className={`fa-solid ${icon} text-white text-xs`}></i>
      <span className="text-white font-bold text-xs uppercase tracking-tight">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      <div className={`${darkColorClass} text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase`}>
        {type}
      </div>
      <button 
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDelete();
        }}
        className="nodrag nopan text-white hover:text-red-200 transition-colors cursor-pointer"
        title="Delete Node"
      >
        <i className="fa-solid fa-trash-can text-xs"></i>
      </button>
    </div>
  </div>
);

"use client";

import { useEffect } from "react";
import { CheckIcon } from "./Icons";

export default function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
      <div className="bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm">
        <CheckIcon className="w-4 h-4 text-green-400" />
        {message}
      </div>
    </div>
  );
}

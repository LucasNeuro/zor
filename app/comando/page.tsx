"use client";
import { DecisionPanel } from "@/components/office/DecisionPanel";

export default function ComandoPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <a href="/office" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Office</a>
        <span className="text-gray-700">/</span>
        <span className="text-white font-bold text-sm">Centro de Comando</span>
      </div>
      <div className="flex-1 max-w-2xl mx-auto w-full py-6 px-4">
        <DecisionPanel />
      </div>
    </div>
  );
}

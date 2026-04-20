import MegaImportSection from "./MegaImportSection";
import ImportWizard from "./ImportWizard";

export default function ImportPage() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Data Import</h1>
        <MegaImportSection />
        <div className="border-t border-[#2a2a2a] pt-6">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-4">Import a Single File</p>
          <ImportWizard />
        </div>
      </div>
    </div>
  );
}

import { getMaterialsLibrary } from "@/app/actions/materials-library";
import MaterialsLibraryClient from "./MaterialsLibraryClient";

export const dynamic = "force-dynamic";

export default async function MaterialsLibraryPage() {
  const materials = await getMaterialsLibrary();
  return <MaterialsLibraryClient initialMaterials={materials} />;
}

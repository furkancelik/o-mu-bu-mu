import { Header } from "@/components/Header";
import { NewGameForm } from "./NewGameForm";

export const dynamic = "force-dynamic";

export default function NewGamePage() {
  return (
    <>
      <Header />
      <NewGameForm />
    </>
  );
}

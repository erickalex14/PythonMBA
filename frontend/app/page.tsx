import { redirect } from "next/navigation";

export default function Home() {
  // Redirecciona automáticamente del root al dashboard
  redirect("/dashboard");
}

import { redirect } from "next/navigation";

export default function Home() {
  // Yaarathu main link-a open pannina, udane chat page-kku redirect pannidum
  redirect("/chat"); 
}
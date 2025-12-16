import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-4 min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-bold">Brick index</h1>
      <Link href="/backend" className="text-blue-500 hover:text-blue-700">
          Backend
      </Link>
    </div>
  );
}

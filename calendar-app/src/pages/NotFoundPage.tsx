import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="mb-3 text-xl font-semibold">找不到此頁面</h1>
      <Link to="/" className="text-blue-700 hover:underline dark:text-blue-400">
        回到首頁
      </Link>
    </div>
  );
}

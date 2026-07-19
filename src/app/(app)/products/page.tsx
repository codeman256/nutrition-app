import type { Metadata } from "next";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Products</h1>
      <p className="mt-2 text-muted-foreground">
        Your supplement bottles will appear here.
      </p>
    </div>
  );
}

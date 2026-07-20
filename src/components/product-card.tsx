"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";
import { deleteProduct } from "@/lib/actions/products";
import { pillColorClass } from "@/data/pill-colors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ProductCardData {
  id: number;
  name: string;
  brand: string | null;
  servingSize: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  pillColor: string | null;
  trackedCount: number;
  totalCount: number;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const router = useRouter();
  const imageSrc = product.imagePath
    ? `/api/uploads/${product.imagePath}`
    : product.imageUrl;

  async function handleDelete() {
    if (!window.confirm(`Delete "${product.name}"? It will also leave your regimen.`)) {
      return;
    }
    await deleteProduct(product.id);
    toast.success("Product deleted");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex gap-3 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="size-20 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className={cn(
              "flex size-20 shrink-0 items-center justify-center rounded-md border text-2xl",
              pillColorClass(product.pillColor),
            )}
          >
            💊
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate font-medium" title={product.name}>
            {product.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[product.brand, product.servingSize].filter(Boolean).join(" · ") || "—"}
          </p>
          <Badge variant="secondary" className="w-fit">
            {product.trackedCount}/{product.totalCount} tracked
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="icon" aria-label={`Edit ${product.name}`}>
            <Link href={`/products/${product.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${product.name}`}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

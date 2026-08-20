"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ProductFilterState {
  search: string;
  status: string;
  is_loose_stone: string;
  gemstone_category: string;
  price_min: string;
  price_max: string;
  sort_by: string;
  order: string;
}

export const DEFAULT_FILTERS: ProductFilterState = {
  search: "",
  status: "all",
  is_loose_stone: "all",
  gemstone_category: "all",
  price_min: "",
  price_max: "",
  sort_by: "created_at",
  order: "desc",
};

interface ProductFiltersProps {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  onReset: () => void;
}

export function ProductFilters({
  value,
  onChange,
  onReset,
}: ProductFiltersProps) {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/options", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCategories(j.gemstone_category ?? []))
      .catch(() => setCategories([]));
  }, []);

  function update<K extends keyof ProductFilterState>(
    key: K,
    v: ProductFilterState[K]
  ) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder="搜索产品名称 / 编号"
        value={value.search}
        onChange={(e) => update("search", e.target.value)}
      />

      <Select value={value.status} onValueChange={(v) => update("status", v)}>
        <SelectTrigger>
          <SelectValue placeholder="销售状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="in_stock">在库</SelectItem>
          <SelectItem value="sold">已售</SelectItem>
          <SelectItem value="consignment">借售</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={value.is_loose_stone}
        onValueChange={(v) => update("is_loose_stone", v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="是否裸石" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部类型</SelectItem>
          <SelectItem value="true">裸石</SelectItem>
          <SelectItem value="false">镶嵌成品</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={value.gemstone_category}
        onValueChange={(v) => update("gemstone_category", v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="宝石分类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部宝石分类</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {categoryLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="最低价"
          value={value.price_min}
          onChange={(e) => update("price_min", e.target.value)}
        />
        <Input
          type="number"
          placeholder="最高价"
          value={value.price_max}
          onChange={(e) => update("price_max", e.target.value)}
        />
      </div>

      <Select value={value.sort_by} onValueChange={(v) => update("sort_by", v)}>
        <SelectTrigger>
          <SelectValue placeholder="排序字段" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">创建时间</SelectItem>
          <SelectItem value="price">价格</SelectItem>
          <SelectItem value="purchased_at">购入时间</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.order} onValueChange={(v) => update("order", v)}>
        <SelectTrigger>
          <SelectValue placeholder="排序方向" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">降序</SelectItem>
          <SelectItem value="asc">升序</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" onClick={onReset} className="lg:col-span-2">
        重置筛选
      </Button>
    </div>
  );
}

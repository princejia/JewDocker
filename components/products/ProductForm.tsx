"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LooseStone, Product, ProductInput } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/ui/NumberInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { FileUpload } from "@/components/ui/FileUpload";
import { Combobox } from "@/components/ui/Combobox";
import { formatCurrency } from "@/lib/utils";
import {
  GEMSTONE_CATEGORY_SUGGESTIONS,
  PRODUCT_FUNCTION_SUGGESTIONS,
  categoryLabel,
  isGoldCategory,
} from "@/lib/constants";

const ORIGIN_PRESETS = ["深圳水贝", "香港", "广州番禺", "周大福", "其他"];

const WEIGHT_UNIT_OPTIONS = ["克(g)", "克拉(ct)"];

interface ProductFormProps {
  initial?: Product;
}

function toFormState(p?: Product): ProductInput {
  return {
    image_urls: p?.image_urls ?? [],
    certificate_urls: p?.certificate_urls ?? [],
    name: p?.name ?? "",
    total_weight: p?.total_weight ?? null,
    weight_unit: p?.weight_unit ?? "克(g)",
    size: p?.size ?? "",
    origin: p?.origin ?? "",
    inlaid_stones: p?.inlaid_stones ?? "",
    gemstone_category: p?.gemstone_category ?? null,
    function_category: p?.function_category ?? null,
    supplier: p?.supplier ?? "",
    labor_sale_price: p?.labor_sale_price ?? null,
    labor_cost: p?.labor_cost ?? null,
    surcharge: p?.surcharge ?? null,
    purchase_discount: p?.purchase_discount ?? null,
    source_loose_stone_id: p?.source_loose_stone_id ?? null,
    price: p?.price ?? 0,
    purchase_price: p?.purchase_price ?? 0,
    sale_price: p?.sale_price ?? 0,
    sale_status: p?.sale_status ?? "in_stock",
    settled_amount: p?.settled_amount ?? 0,
    is_consignment: p?.is_consignment ?? false,
    is_loose_stone: p?.is_loose_stone ?? false,
    purchased_at: p?.purchased_at ?? null,
    sold_at: p?.sold_at ?? null,
    notes: p?.notes ?? "",
  };
}

export function ProductForm({ initial }: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductInput>(toFormState(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromLooseStone, setFromLooseStone] = useState(
    !!initial?.source_loose_stone_id
  );
  const [looseStones, setLooseStones] = useState<LooseStone[]>([]);
  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [functionOptions, setFunctionOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/options")
      .then((res) => res.json())
      .then((json) => {
        setGemstoneOptions(json.gemstone_category ?? []);
        setFunctionOptions(json.function_category ?? []);
      })
      .catch(() => {});
  }, []);

  const gemstoneSuggestions = [
    ...GEMSTONE_CATEGORY_SUGGESTIONS,
    ...gemstoneOptions,
  ];
  const functionSuggestions = [
    ...PRODUCT_FUNCTION_SUGGESTIONS,
    ...functionOptions,
  ];

  useEffect(() => {
    if (!fromLooseStone || looseStones.length > 0) return;
    fetch("/api/loose-stones")
      .then((res) => res.json())
      .then((json) => setLooseStones(json.data ?? []))
      .catch(() => setLooseStones([]));
  }, [fromLooseStone, looseStones.length]);

  const unsettled = Number(form.price || 0) - Number(form.settled_amount || 0);
  const profit = Number(form.price || 0) - Number(form.purchase_price || 0);

  const isGold = isGoldCategory(form.gemstone_category);
  // 黄金计价：进货价按 g/元 计
  const laborSubtotal =
    Number(form.total_weight || 0) * Number(form.labor_cost || 0);
  const surchargeSubtotal =
    Number(form.surcharge || 0) * Number(form.purchase_discount || 0);
  const goldPriceCost =
    Number(form.total_weight || 0) * Number(form.purchase_price || 0);
  const totalPurchaseCost = laborSubtotal + surchargeSubtotal + goldPriceCost;

  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFromLooseStoneToggle(checked: boolean) {
    setFromLooseStone(checked);
    if (!checked) set("source_loose_stone_id", null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("产品名称必填");
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      total_weight:
        form.total_weight === null || (form.total_weight as unknown) === ""
          ? null
          : Number(form.total_weight),
      price: Number(form.price || 0),
      purchase_price: Number(form.purchase_price || 0),
      sale_price: Number(form.sale_price || 0),
      settled_amount: Number(form.settled_amount || 0),
      weight_unit: form.weight_unit || null,
      size: form.size || null,
      origin: form.origin || null,
      inlaid_stones: form.inlaid_stones || null,
      gemstone_category: form.gemstone_category || null,
      function_category: form.function_category || null,
      supplier: form.supplier || null,
      labor_sale_price: isGold ? form.labor_sale_price ?? null : null,
      labor_cost: isGold ? form.labor_cost ?? null : null,
      surcharge: isGold ? form.surcharge ?? null : null,
      purchase_discount: isGold ? form.purchase_discount ?? null : null,
      source_loose_stone_id: fromLooseStone
        ? form.source_loose_stone_id || null
        : null,
      notes: form.notes || null,
      purchased_at: form.purchased_at || null,
      sold_at: form.sold_at || null,
    };

    const url = initial ? `/api/products/${initial.id}` : "/api/products";
    const method = initial ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "保存失败");
      return;
    }

    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 图片 */}
      <div className="space-y-2">
        <Label>产品图片</Label>
        <ImageUpload
          value={form.image_urls}
          onChange={(urls) => set("image_urls", urls)}
        />
      </div>

      {/* 认证报告 */}
      <div className="space-y-2">
        <Label>认证报告</Label>
        <FileUpload
          value={form.certificate_urls}
          onChange={(urls) => set("certificate_urls", urls)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">产品名称 *</Label>
          <Input
            id="name"
            value={form.name}
            maxLength={255}
            onChange={(e) => set("name", e.target.value)}
            placeholder="如：18K金钻石戒指"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_weight">重量</Label>
          <NumberInput
            id="total_weight"
            step="0.001"
            value={form.total_weight}
            onChange={(v) => set("total_weight", v)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight_unit">重量单位</Label>
          <Combobox
            id="weight_unit"
            value={form.weight_unit ?? ""}
            onChange={(v) => set("weight_unit", v || null)}
            options={WEIGHT_UNIT_OPTIONS}
            placeholder="如：克(g) / 克拉(ct)"
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">尺寸</Label>
          <Input
            id="size"
            value={form.size ?? ""}
            onChange={(e) => set("size", e.target.value)}
            placeholder="如：12号 / 18cm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="origin">产地</Label>
          <Input
            id="origin"
            list="origin-presets"
            value={form.origin ?? ""}
            onChange={(e) => set("origin", e.target.value)}
            placeholder="如：深圳水贝"
          />
          <datalist id="origin-presets">
            {ORIGIN_PRESETS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="inlaid_stones">镶嵌配石</Label>
          <Textarea
            id="inlaid_stones"
            value={form.inlaid_stones ?? ""}
            onChange={(e) => set("inlaid_stones", e.target.value)}
            placeholder="如：主石1ct D/VVS1，配石0.3ct"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gemstone_category">宝石分类</Label>
          <Combobox
            id="gemstone_category"
            value={form.gemstone_category ?? ""}
            onChange={(v) => set("gemstone_category", v || null)}
            options={gemstoneSuggestions}
            placeholder="输入或选择宝石分类"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="function_category">功能分类</Label>
          <Combobox
            id="function_category"
            value={form.function_category ?? ""}
            onChange={(v) => set("function_category", v || null)}
            options={functionSuggestions}
            placeholder="输入或选择功能分类"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier">供应商</Label>
          <Input
            id="supplier"
            value={form.supplier ?? ""}
            maxLength={100}
            onChange={(e) => set("supplier", e.target.value)}
            placeholder="如：深圳水贝某某珠宝"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">价格 (¥) *</Label>
          <NumberInput
            id="price"
            step="0.01"
            value={form.price}
            onChange={(v) => set("price", v ?? 0)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_price">进货价 (¥)</Label>
          <NumberInput
            id="purchase_price"
            step="0.01"
            value={form.purchase_price}
            onChange={(v) => set("purchase_price", v ?? 0)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_price">出售价 (¥)</Label>
          <NumberInput
            id="sale_price"
            step="0.01"
            value={form.sale_price}
            onChange={(v) => set("sale_price", v ?? 0)}
          />
        </div>

        {form.sale_status === "consignment" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="settled_amount">结款 (¥)</Label>
              <NumberInput
                id="settled_amount"
                step="0.01"
                value={form.settled_amount}
                onChange={(v) => set("settled_amount", v ?? 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>未结款 (¥)</Label>
              <div
                className={`flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-medium ${
                  unsettled > 0 ? "text-red-500" : "text-gray-500"
                }`}
              >
                {formatCurrency(unsettled)}
              </div>
            </div>
          </>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label>利润 (¥)</Label>
          <div className="flex h-10 items-center rounded-md border bg-green-50 px-3 text-sm font-medium text-green-700">
            {formatCurrency(profit)}
          </div>
        </div>
      </div>

      {/* 黄金专用计价 */}
      {isGold && (
        <div className="space-y-4 rounded-md border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-sm font-semibold text-amber-800">黄金计价</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="labor_sale_price">工费销售价格 (g/元)</Label>
              <NumberInput
                id="labor_sale_price"
                step="0.01"
                value={form.labor_sale_price}
                onChange={(v) => set("labor_sale_price", v)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor_cost">工费成本 (g/元)</Label>
              <NumberInput
                id="labor_cost"
                step="0.01"
                value={form.labor_cost}
                onChange={(v) => set("labor_cost", v)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="surcharge">附加费 (元)</Label>
              <NumberInput
                id="surcharge"
                step="0.01"
                value={form.surcharge}
                onChange={(v) => set("surcharge", v)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_discount">买入折扣</Label>
              <NumberInput
                id="purchase_discount"
                step="0.0001"
                value={form.purchase_discount}
                onChange={(v) => set("purchase_discount", v)}
                placeholder="如：0.95"
              />
            </div>

            <div className="space-y-2">
              <Label>工费小计 (¥)</Label>
              <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-medium text-gray-700">
                {formatCurrency(laborSubtotal)}
              </div>
              <p className="text-xs text-gray-400">重量 × 工费成本</p>
            </div>

            <div className="space-y-2">
              <Label>附加费小计 (¥)</Label>
              <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-medium text-gray-700">
                {formatCurrency(surchargeSubtotal)}
              </div>
              <p className="text-xs text-gray-400">附加费 × 买入折扣</p>
            </div>

            <div className="space-y-2">
              <Label>进货金价成本 (¥)</Label>
              <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-medium text-gray-700">
                {formatCurrency(goldPriceCost)}
              </div>
              <p className="text-xs text-gray-400">重量 × 进货价</p>
            </div>

            <div className="space-y-2">
              <Label>进货总成本 (¥)</Label>
              <div className="flex h-10 items-center rounded-md border bg-amber-100 px-3 text-sm font-semibold text-amber-800">
                {formatCurrency(totalPurchaseCost)}
              </div>
              <p className="text-xs text-gray-400">
                工费小计 + 附加费小计 + 进货金价成本
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 从现有裸石生产 */}
      <div className="space-y-3 rounded-md border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={fromLooseStone}
            onCheckedChange={handleFromLooseStoneToggle}
            id="from_loose_stone"
          />
          <Label htmlFor="from_loose_stone">从现有裸石生产</Label>
        </div>
        {fromLooseStone && (
          <div className="space-y-2">
            <Label>选择裸石</Label>
            <Select
              value={form.source_loose_stone_id ?? ""}
              onValueChange={(v) => set("source_loose_stone_id", v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择一颗裸石" />
              </SelectTrigger>
              <SelectContent>
                {looseStones.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-gray-400">
                    暂无裸石数据
                  </div>
                ) : (
                  looseStones.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {[
                        s.gemstone_category
                          ? categoryLabel(s.gemstone_category)
                          : null,
                        s.material,
                        s.size,
                        s.weight != null
                          ? `${s.weight}${s.weight_unit || "克(g)"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "裸石"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 日期 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="purchased_at">购入时间</Label>
          <Input
            id="purchased_at"
            type="date"
            value={form.purchased_at ?? ""}
            onChange={(e) => set("purchased_at", e.target.value || null)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea
          id="notes"
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中..." : initial ? "保存修改" : "创建产品"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          取消
        </Button>
      </div>
    </form>
  );
}

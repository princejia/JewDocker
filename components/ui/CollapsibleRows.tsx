"use client";

import { Children, useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";

interface CollapsibleRowsProps {
  children: React.ReactNode;
  colSpan: number;
  /** 折叠时显示的行数 */
  initial?: number;
}

export function CollapsibleRows({
  children,
  colSpan,
  initial = 12,
}: CollapsibleRowsProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = Children.toArray(children);

  if (rows.length <= initial) return <>{rows}</>;

  return (
    <>
      {expanded ? rows : rows.slice(0, initial)}
      <TableRow>
        <TableCell colSpan={colSpan} className="py-2 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm text-amber-700 hover:underline"
          >
            {expanded ? "收起" : `展开全部（共 ${rows.length} 条）`}
          </button>
        </TableCell>
      </TableRow>
    </>
  );
}

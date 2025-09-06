// components/import/ImportPreviewTable.tsx
import React from "react";
import type { NormalizedRow } from "@/hooks/useBulkImport";

type Props = {
  rows: NormalizedRow[];
};

export default function ImportPreviewTable({ rows }: Props) {
  if (!rows || rows.length === 0) {
    return null;
  }

  const fmtNum = (v?: number) =>
    typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-";

  const fmtStr = (v?: string) => (v && v.trim().length ? v : "-");

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm text-gray-900">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
          <tr>
            <th className="px-3 py-2">Symbol</th>
            <th className="px-3 py-2">Side</th>
            <th className="px-3 py-2">Quantity</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Timestamp</th>
            <th className="px-3 py-2">Fee</th>
            <th className="px-3 py-2">Fee Currency</th>
            <th className="px-3 py-2">Ext Ref</th>
            <th className="px-3 py-2">Client Tx Id</th>
            <th className="px-3 py-2">Note</th>
            <th className="px-3 py-2">Exchange</th>
            <th className="px-3 py-2">Import Batch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-900">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono">{fmtStr(r.symbol)}</td>
              <td className="px-3 py-2">{fmtStr(r.side)}</td>
              <td className="px-3 py-2">{fmtNum(r.quantity)}</td>
              <td className="px-3 py-2">{fmtNum(r.price)}</td>
              <td className="px-3 py-2">{fmtStr(r.timestamp)}</td>
              <td className="px-3 py-2">{fmtNum(r.fee)}</td>
              <td className="px-3 py-2">{fmtStr(r.fee_currency)}</td>
              <td className="px-3 py-2">{fmtStr(r.ext_ref)}</td>
              <td className="px-3 py-2">{fmtStr(r.client_tx_id)}</td>
              <td className="px-3 py-2">{fmtStr(r.note)}</td>
              <td className="px-3 py-2">{fmtStr(r.exchange)}</td>
              <td className="px-3 py-2">{fmtStr(r.import_batch_id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

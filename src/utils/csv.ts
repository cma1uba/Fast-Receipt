import { ReceiptData } from "../types";

export function exportReceiptsToCSV(receipts: ReceiptData[], filename?: string) {
  const headers = [
    "Record ID",
    "Merchant / Vendor",
    "Total Amount",
    "Sales Tax",
    "Currency Code",
    "Category Classification",
    "Transaction Date",
    "Itemized Details list"
  ];

  const csvRows = [headers.join(",")];

  for (const r of receipts) {
    const itemsString = r.items && r.items.length > 0
      ? r.items.map((item) => `${item.quantity || 1}x ${item.name} ($${item.price.toFixed(2)})`).join(" | ")
      : "None";

    const row = [
      r.id,
      r.vendor,
      r.amount,
      r.tax,
      r.currency,
      r.category,
      r.date,
      itemsString
    ];
    // Escape enclosing values correctly
    const escapedRow = row.map((val) => {
      const itemStr = String(val === undefined || val === null ? "" : val);
      const doubleQuoted = itemStr.replace(/"/g, '""');
      return `"${doubleQuoted}"`;
    });
    csvRows.push(escapedRow.join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const blobUrl = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = blobUrl;
  const targetFilename = filename || `receipt_grabber_ledger_${new Date().toISOString().split("T")[0]}.csv`;
  link.download = targetFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);

  pendo.track("csv_export_completed", {
    receiptCount: receipts.length,
    filename: targetFilename,
  });
}

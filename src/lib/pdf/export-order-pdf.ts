import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type OrderPdfItem = {
  article_code?: string | null;
  article_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type OrderPdfData = {
  orderNumber: string;
  projectName: string;
  orderDate: string;
  creatorName: string;
  status: string;
  subtotal: number;
  vatTotal: number;
  totalWithVat: number;
  items: OrderPdfItem[];
};

const SELLER = {
  name: "BRENADO FOR HOUSE SRL",
  regNo: "J2020000393160",
  fiscalCode: "42311924",
  address: "str. Craiovei, nr. 28 A, Galicea Mare, Dolj",
  email: "for-house@brenado.ro",
};

const BUYER = {
  name: "BRENADO SRL",
  regNo: "J2017000063160",
  fiscalCode: "36931450",
  address: "str. Teilor, nr. 8, Galicea Mare, Dolj",
  email: "office@brenado.ro",
};

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawWrappedLines(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4
) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let currentY = y;

  for (const line of lines) {
    doc.text(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function drawPartyBox(
  doc: jsPDF,
  title: string,
  party: {
    name: string;
    regNo: string;
    fiscalCode: string;
    address: string;
    email: string;
  },
  x: number,
  y: number,
  width: number,
  height: number
) {
  doc.setDrawColor(225, 225, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");

  let cursorY = y + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(title, x + 3, cursorY);

  cursorY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(party.name, x + 3, cursorY);

  cursorY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  doc.text(`Reg. Com.: ${party.regNo}`, x + 3, cursorY);
  cursorY += 4;

  doc.text(`CUI: ${party.fiscalCode}`, x + 3, cursorY);
  cursorY += 4;

  cursorY = drawWrappedLines(
    doc,
    `Adresa: ${party.address}`,
    x + 3,
    cursorY,
    width - 6,
    4
  );

  drawWrappedLines(
    doc,
    `Email: ${party.email}`,
    x + 3,
    cursorY,
    width - 6,
    4
  );
}

export async function exportOrderPdf(data: OrderPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 6;

  const logo = await loadImage("/logo.png");

if (logo) {
  doc.addImage(logo, "PNG", margin, 10, 65, 24);
}

doc.setFont("helvetica", "bold");
doc.setFontSize(10);

let statusLabel = data.status;
let statusColor: [number, number, number] = [90, 90, 90];

if (data.status === "draft") {
  statusLabel = "DRAFT";
  statusColor = [100, 100, 100];
} else if (data.status === "asteapta_confirmare") {
  statusLabel = "IN ASTEPTARE";
  statusColor = [245, 158, 11];
} else if (data.status === "aprobata") {
  statusLabel = "APROBATA";
  statusColor = [22, 163, 74];
} else if (data.status === "refuzata") {
  statusLabel = "REFUZATA";
  statusColor = [220, 38, 38];
}

doc.setTextColor(...statusColor);
doc.text(`STATUS: ${statusLabel}`, margin, 38);

doc.setFont("helvetica", "bold");
doc.setFontSize(18);
doc.setTextColor(1, 150, 255);
doc.text("COMANDA FURNIZOR", pageWidth / 2, 42, { align: "center" });

  doc.setDrawColor(230, 230, 230);
  doc.line(margin, 48, pageWidth - margin, 48);

  const boxY = 54;
  const boxGap = 6;
  const totalContentWidth = pageWidth - margin * 2;
  const boxWidth = (totalContentWidth - boxGap) / 2;
  const boxHeight = 30;

  const leftBoxX = margin;
  const rightBoxX = leftBoxX + boxWidth + boxGap;

  drawPartyBox(doc, "VANZATOR", SELLER, leftBoxX, boxY, boxWidth, boxHeight);
  drawPartyBox(doc, "CUMPARATOR", BUYER, rightBoxX, boxY, boxWidth, boxHeight);

  const infoY = 88;
  const infoX = margin;
  const infoW = pageWidth - margin * 2;
  const infoH = 16;

  doc.setDrawColor(225, 225, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(infoX, infoY, infoW, infoH, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  doc.text(`Nr. comanda: ${data.orderNumber}`, infoX + 3, infoY + 6);
  doc.text(`Data: ${data.orderDate}`, infoX + infoW - 3, infoY + 6, {
    align: "right",
  });

  doc.text(`Santier: ${data.projectName || "-"}`, infoX + 3, infoY + 12);
  doc.text(`Creat de: ${data.creatorName}`, infoX + infoW - 3, infoY + 12, {
    align: "right",
  });

autoTable(doc, {
  startY: infoY + infoH + 6,
  margin: { left: margin, right: margin },
  tableWidth: pageWidth - margin * 2,
  head: [["Nr.", "Cod", "Denumire", "UM", "Qty", "P.U. (lei)", "T. Valoare (lei)"]],
  body: data.items.map((item, index) => [
    index + 1,
    item.article_code || "-",
    item.article_name,
    item.unit || "-",
    item.quantity,
    item.unit_price.toFixed(2),
    item.line_total.toFixed(2),
  ]),
  styles: {
    font: "helvetica",
    fontSize: 9,
    cellPadding: 2.5,
    textColor: [40, 40, 40],
    lineColor: [230, 230, 230],
    lineWidth: 0.2,
    valign: "middle",
    overflow: "linebreak",
  },
  headStyles: {
    fillColor: [1, 150, 255],
    textColor: [255, 255, 255],
    fontStyle: "bold",
  },
  columnStyles: {
    0: { cellWidth: 10, halign: "center" },
  },
  didParseCell: (hookData) => {
    if (hookData.column.index === 2) {
      hookData.cell.styles.cellWidth = "auto";
    }
  },
});

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 130;

  const totalsW = 60;
  const totalsX = pageWidth - margin - totalsW;
  const totalsY = finalY + 8;
  const rowH = 7;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(totalsX, totalsY, totalsW, 26, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);

  doc.text("Subtotal", totalsX + 3, totalsY + 6);
  doc.text(`${data.subtotal.toFixed(2)} lei`, totalsX + totalsW - 3, totalsY + 6, {
    align: "right",
  });

  doc.text("TVA 21%", totalsX + 3, totalsY + 6 + rowH);
  doc.text(
    `${data.vatTotal.toFixed(2)} lei`,
    totalsX + totalsW - 3,
    totalsY + 6 + rowH,
    { align: "right" }
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(1, 150, 255);
  doc.text("Total", totalsX + 3, totalsY + 6 + rowH * 2);
  doc.text(
    `${data.totalWithVat.toFixed(2)} lei`,
    totalsX + totalsW - 3,
    totalsY + 6 + rowH * 2,
    { align: "right" }
  );

  doc.save(`comanda-${data.orderNumber}.pdf`);
}
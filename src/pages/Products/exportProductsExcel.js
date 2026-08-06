import ExcelJS from 'exceljs';

const INDIGO = 'FF4F46E5';
const INDIGO_LIGHT = 'FFEEF2FF';
const SLATE_LIGHT = 'FFF8FAFC';
const SLATE_TEXT = 'FF1E293B';
const ROSE_LIGHT = 'FFFEE2E2';
const ROSE_TEXT = 'FFB91C1C';
const EMERALD_TEXT = 'FF047857';
const BORDER = { style: 'thin', color: { argb: 'FFE2E8F0' } };
const BOX = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

/** Dải tiêu đề màu indigo ở đầu mỗi sheet — cho cảm giác thống nhất giữa các sheet. */
function addTitleBand(sheet, text, span) {
  sheet.mergeCells(1, 1, 1, span);
  const cell = sheet.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 8;
}

/**
 * Vẽ 1 bảng: header tô indigo, border đủ 4 cạnh, zebra stripe, căn lề/định dạng theo từng cột.
 * columns: [{ header, width, align, numFmt, bold, color }]
 * rows: mảng giá trị thô theo đúng thứ tự columns
 * cellStyle(rowIndex, colIndex, value, rowData) -> object override style cho 1 ô cụ thể (optional)
 * Trả về số dòng tiếp theo còn trống, để ghép nhiều bảng trên cùng 1 sheet.
 */
function addTable(sheet, startRow, columns, rows, cellStyle) {
  const headerRow = sheet.getRow(startRow);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BOX;
  });
  headerRow.height = 22;

  rows.forEach((rowData, rIdx) => {
    const row = sheet.getRow(startRow + 1 + rIdx);
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.value = rowData[i];
      cell.border = BOX;
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', wrapText: !!col.wrap };
      cell.font = { size: 10.5, bold: !!col.bold, color: { argb: col.color ?? SLATE_TEXT } };
      if (col.numFmt) cell.numFmt = col.numFmt;
      if (rIdx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_LIGHT } };
      const override = cellStyle?.(rIdx, i, rowData[i], rowData);
      if (override?.font) cell.font = { ...cell.font, ...override.font };
      if (override?.fill) cell.fill = override.fill;
    });
    row.height = 20;
  });

  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width;
  });

  return startRow + 1 + rows.length;
}

function finalizeSheet(sheet, headerRowNumber) {
  sheet.views = [...(sheet.views ?? []), { state: 'frozen', ySplit: headerRowNumber, showGridLines: false }];
  sheet.properties.tabColor = { argb: INDIGO };
}

/** Dựng workbook báo cáo "Sản phẩm — Vận hành theo tháng" — tách riêng để test được không phụ thuộc DOM. */
export function buildProductOperationsWorkbook(dashboard, filters = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM VCB';
  wb.created = new Date();

  const meta = [
    ['Danh mục', filters.categoryLabel ?? 'Tất cả danh mục'],
    ['Kho', filters.locationLabel ?? 'Tất cả kho'],
    ['Ngày xuất', new Date().toLocaleString('vi-VN')],
  ];

  // ── Sheet 1: Tổng quan ──────────────────────────────────────────────
  const overview = wb.addWorksheet('Tổng quan');
  addTitleBand(overview, `Báo cáo vận hành sản phẩm — Tháng ${dashboard.month}`, 3);

  let row = 3;
  meta.forEach(([label, value]) => {
    const labelCell = overview.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10.5, color: { argb: SLATE_TEXT } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_LIGHT } };
    const valueCell = overview.getCell(row, 2);
    valueCell.value = value;
    valueCell.font = { size: 10.5, color: { argb: SLATE_TEXT } };
    [labelCell, valueCell].forEach((c) => {
      c.border = BOX;
      c.alignment = { vertical: 'middle' };
    });
    row += 1;
  });
  row += 1;

  row =
    addTable(
      overview,
      row,
      [
        { header: 'Chỉ số chính', width: 32 },
        { header: 'Giá trị', width: 20, align: 'right' },
      ],
      [
        ['SP lên đơn trong tháng', dashboard.kpis.ordered.toLocaleString('vi-VN')],
        ['SP đã xuất hàng', dashboard.kpis.shipped.toLocaleString('vi-VN')],
        ['Tỉ lệ xuất / lên đơn', `${Math.round(dashboard.kpis.shipToOrderRate)}%`],
        ['SP thiếu hàng khi lên đơn', dashboard.kpis.stockoutCount.toLocaleString('vi-VN')],
        ['Tổng đơn bị kẹt vì thiếu tồn', dashboard.kpis.stuckOrdersTotal.toLocaleString('vi-VN')],
      ],
    ) + 1;

  addTable(
    overview,
    row,
    [
      { header: 'Chỉ số bổ sung', width: 32 },
      { header: 'Giá trị', width: 20, align: 'right' },
      { header: 'Ghi chú', width: 34, wrap: true },
    ],
    dashboard.extraMetrics.map((m) => [m.label, m.value, m.caption]),
  );
  overview.views = [{ showGridLines: false }];

  // ── Sheet 2: Top sản phẩm được order ────────────────────────────────
  const topSheet = wb.addWorksheet('Top order');
  addTitleBand(topSheet, `Top sản phẩm được order nhiều nhất — Tháng ${dashboard.month}`, 6);
  addTable(
    topSheet,
    3,
    [
      { header: 'Hạng', width: 8, align: 'center', bold: true },
      { header: 'Sản phẩm', width: 46, wrap: true },
      { header: 'Danh mục', width: 22 },
      { header: 'Lượt đặt', width: 12, align: 'right', numFmt: '#,##0' },
      { header: 'Số lượng', width: 12, align: 'right', numFmt: '#,##0' },
      { header: '% so tháng trước', width: 16, align: 'right', numFmt: '+0.0%;-0.0%' },
    ],
    dashboard.topOrdered.map((p) => [p.rank, p.name, p.category, p.count, p.qty, p.changePct / 100]),
    (_r, colIdx, value) =>
      colIdx === 5 ? { font: { color: { argb: value >= 0 ? EMERALD_TEXT : ROSE_TEXT } } } : null,
  );
  finalizeSheet(topSheet, 3);

  // ── Sheet 3: Sản phẩm thiếu hàng (đầy đủ, không phân trang) ─────────
  const stockSheet = wb.addWorksheet('Thiếu hàng');
  addTitleBand(stockSheet, `Sản phẩm thiếu hàng — Tháng ${dashboard.month}`, 5);
  addTable(
    stockSheet,
    3,
    [
      { header: 'Sản phẩm', width: 46, wrap: true },
      { header: 'SKU', width: 20 },
      { header: 'Thiếu', width: 10, align: 'right', numFmt: '#,##0' },
      { header: 'Khả dụng', width: 12, align: 'right', numFmt: '#,##0' },
      { header: 'Đơn kẹt', width: 12, align: 'right', numFmt: '#,##0' },
    ],
    dashboard.stockouts.map((s) => [s.name, s.sku, s.shortage, s.available, s.stuckOrders]),
    (_r, colIdx) =>
      colIdx === 2
        ? {
            font: { bold: true, color: { argb: ROSE_TEXT } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ROSE_LIGHT } },
          }
        : null,
  );
  finalizeSheet(stockSheet, 3);

  // ── Sheet 4: Top 10 doanh thu ────────────────────────────────────────
  const revSheet = wb.addWorksheet('Top doanh thu');
  addTitleBand(revSheet, `Top 10 sản phẩm doanh thu cao nhất — Tháng ${dashboard.month}`, 5);
  let revTableRow = 3;
  if (filters.categoryLabel) {
    revSheet.mergeCells(3, 1, 3, 5);
    const noteCell = revSheet.getCell(3, 1);
    noteCell.value = '* Chỉ áp dụng bộ lọc Tháng/Kho — OMS chưa hỗ trợ lọc theo Danh mục cho báo cáo doanh thu sản phẩm.';
    noteCell.font = { italic: true, size: 9.5, color: { argb: 'FFB45309' } };
    revTableRow = 5;
  }
  addTable(
    revSheet,
    revTableRow,
    [
      { header: 'Hạng', width: 8, align: 'center', bold: true },
      { header: 'Sản phẩm', width: 46, wrap: true },
      { header: 'SKU', width: 20 },
      { header: 'Số lượng', width: 12, align: 'right', numFmt: '#,##0' },
      { header: 'Doanh thu', width: 20, align: 'right', numFmt: '#,##0" đ"', bold: true, color: INDIGO },
    ],
    dashboard.topRevenueProducts.map((p, i) => [i + 1, p.name, p.sku, p.quantity, p.revenue]),
  );
  finalizeSheet(revSheet, revTableRow);

  return wb;
}

/** Xuất báo cáo "Sản phẩm — Vận hành theo tháng" ra file Excel nhiều sheet, có định dạng, tải về trình duyệt. */
export async function exportProductOperationsExcel(dashboard, filters = {}) {
  const wb = buildProductOperationsWorkbook(dashboard, filters);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bao-cao-san-pham-${dashboard.month}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

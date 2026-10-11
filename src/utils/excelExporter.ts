/**
 * Universal Excel Exporter Utility
 * Generates beautifully formatted Microsoft Excel-compatible files (.xls)
 * with proper styles, headers, and gridlines using the HTML/XML Spreadsheet standard.
 */

export interface HarvestSaleExportRow {
    'Date / თარიღი': string;
    'Batch / პარტია': string;
    'Produce Name / დასახელება': string;
    'Cultivar Variety / ჯიში': string;
    'Weight (KG) / წონა (კგ)': number;
    'Unit Price / ფასი': number;
    'Exchange Rate / კურსი': number;
    'Gross Revenue / ბრუნვა': number;
    'LLC Deposit / ბანკი (LLC)': number;
    'Cash Deposit / ნაღდი': number;
    'Opex Labor/Vehicles / საოპერაციო ხარჯი': number;
    'Packaging Materials / მასალები': number;
    'Net Revenue / წმინდა მოგება': number;
    'Buyer / მყიდველი': string;
    'Paid / გადახდილი': string;
    'Status / სტატუსი': string;
}

export function exportToExcel(data: any[], fileName: string, sheetName: string) {
    if (!data || data.length === 0) {
        console.warn("No data provided to exportToExcel");
        return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);

    // Build the table rows HTML
    let tableHeaderHtml = '<tr>';
    headers.forEach(header => {
        tableHeaderHtml += `<th>${escapeXml(header)}</th>`;
    });
    tableHeaderHtml += '</tr>';

    let tableRowsHtml = '';
    data.forEach((row, idx) => {
        const rowClass = idx % 2 === 0 ? '' : 'odd-row';
        tableRowsHtml += `<tr class="${rowClass}">`;
        headers.forEach(header => {
            const val = row[header];
            if (typeof val === 'number') {
                // Check if it's monetary or general number
                const isPrice = header.toLowerCase().includes('price') || 
                                header.toLowerCase().includes('revenue') || 
                                header.toLowerCase().includes('deposit') || 
                                header.toLowerCase().includes('opex') || 
                                header.toLowerCase().includes('materials') || 
                                header.toLowerCase().includes('ხარჯი') || 
                                header.toLowerCase().includes('მოგება') || 
                                header.toLowerCase().includes('ბრუნვა');
                
                const formatted = isPrice ? val.toFixed(2) : val.toString();
                tableRowsHtml += `<td class="number">${formatted}</td>`;
            } else {
                tableRowsHtml += `<td>${escapeXml(String(val ?? ''))}</td>`;
            }
        });
        tableRowsHtml += '</tr>';
    });

    // Calculate totals if rows have numeric fields
    let totalsRowHtml = '';
    const numericFields = headers.map(h => {
        const isNumeric = data.some(row => typeof row[h] === 'number');
        return isNumeric;
    });

    if (numericFields.some(Boolean)) {
        totalsRowHtml += '<tr class="total-row">';
        headers.forEach((header, idx) => {
            if (idx === 0) {
                totalsRowHtml += '<td><strong>TOTALS / ჯამი</strong></td>';
            } else if (numericFields[idx]) {
                const total = data.reduce((sum, row) => sum + (Number(row[header]) || 0), 0);
                const isWeight = header.toLowerCase().includes('weight') || header.toLowerCase().includes('წონა');
                const formatted = isWeight ? total.toFixed(1) : total.toFixed(2);
                totalsRowHtml += `<td class="number"><strong>${formatted}</strong></td>`;
            } else {
                totalsRowHtml += '<td></td>';
            }
        });
        totalsRowHtml += '</tr>';
    }

    // Embed in full Excel XML/HTML template with gridlines and styles
    const template = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>${escapeXml(sheetName)}</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: block; margin: 20px; }
  h2 { font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; color: #1e293b; margin-bottom: 5px; font-weight: 800; }
  p { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #64748b; margin-top: 0; margin-bottom: 15px; font-weight: 500; }
  table { border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; }
  th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 11px; color: #334155; }
  .odd-row { background-color: #f8fafc; }
  .number { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row { background-color: #e2e8f0; font-weight: bold; }
  .total-row td { color: #0f172a; border-top: 2px double #475569; border-bottom: 2px double #475569; }
</style>
</head>
<body>
  <h2>${escapeXml(sheetName)}</h2>
  <p>Exported on: ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      ${tableHeaderHtml}
    </thead>
    <tbody>
      ${tableRowsHtml}
      ${totalsRowHtml}
    </tbody>
  </table>
</body>
</html>
`;

    // Download flow
    const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName.endsWith('.xls') ? fileName : `${fileName}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportToGoogleSheetsClipboard(data: any[]): boolean {
    if (!data || data.length === 0) return false;
    const headers = Object.keys(data[0]);
    const lines = [
        headers.join('\t'),
        ...data.map(row => headers.map(h => {
            const val = row[h];
            return val !== undefined && val !== null ? String(val).replace(/\t/g, ' ') : '';
        }).join('\t'))
    ];
    const tsvContent = lines.join('\n');
    try {
        navigator.clipboard.writeText(tsvContent);
        return true;
    } catch {
        return false;
    }
}

export function exportToCsv(data: any[], fileName: string) {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
        ...data.map(row => headers.map(h => {
            const val = row[h];
            const str = val !== undefined && val !== null ? String(val) : '';
            return `"${str.replace(/"/g, '""')}"`;
        }).join(','))
    ];
    const blob = new Blob(["\uFEFF" + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

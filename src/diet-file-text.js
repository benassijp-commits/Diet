const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

let pdfjsPromise = null;
let xlsxPromise = null;

export async function extractDietFileText(file) {
  const extension = fileExtension(file.name);
  const mime = String(file.type || "").toLowerCase();

  if (extension === "pdf" || mime === "application/pdf") {
    return extractPdfText(file);
  }

  if (["xlsx", "xls", "ods"].includes(extension) || mime.includes("spreadsheet") || mime.includes("excel")) {
    return extractSpreadsheetText(file);
  }

  return file.text();
}

async function extractPdfText(file) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => item.str)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(`Pagina ${pageNumber}\n${text}`);
  }

  const result = pages.join("\n\n").trim();
  if (!result) {
    throw new Error("Não foi possível extrair texto deste PDF. Se ele for escaneado como imagem, envie uma versão com texto selecionável.");
  }
  return result;
}

async function extractSpreadsheetText(file) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    return csv ? `Aba: ${sheetName}\n${csv}` : "";
  }).filter(Boolean);

  const result = sheets.join("\n\n").trim();
  if (!result) throw new Error("Não foi possível extrair texto desta planilha.");
  return result;
}

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = loadScript(PDFJS_URL, "pdfjsLib").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function loadXlsx() {
  if (!xlsxPromise) xlsxPromise = loadScript(XLSX_URL, "XLSX");
  return xlsxPromise;
}

function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => window[globalName]
      ? resolve(window[globalName])
      : reject(new Error(`Biblioteca ${globalName} não carregou corretamente.`));
    script.onerror = () => reject(new Error(`Não foi possível carregar ${globalName}. Verifique a conexão e tente novamente.`));
    document.head.appendChild(script);
  });
}

function fileExtension(name) {
  return String(name || "").split(".").pop().toLowerCase();
}

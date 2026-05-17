import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

/* ================================
   CONFIGURATION
================================ */

const SHOP_NAME = "ES-SHOP";
const SHOP_ADDRESS = "Rughenda-Kaleverio";
const SHOP_PHONE = "+243840344307";

const logoUrl = "logo.png";

/*
58mm ≈ 164pt
80mm ≈ 226pt
*/

const TICKET_WIDTH = 226;

const FONT_FAMILY = "courier";

const FONT_SIZE_NORMAL = 8;
const FONT_SIZE_SMALL = 7;
const FONT_SIZE_TITLE = 11;
const FONT_SIZE_TOTAL = 12;

const LEFT = 8;
const RIGHT = 218;

/* ================================
   CHARGEMENT IMAGE
================================ */

async function loadImage(url) {

  return new Promise((resolve) => {

    const img = new Image();

    img.onload = () => {

      const canvas =
        document.createElement("canvas");

      canvas.width = img.width;
      canvas.height = img.height;

      const ctx =
        canvas.getContext("2d");

      ctx.drawImage(img, 0, 0);

      resolve(
        canvas.toDataURL("image/png")
      );

    };

    img.onerror = () => resolve(null);

    img.src = url;

  });

}

/* ================================
   FORMAT DATE
================================ */

function formatDate(date) {

  const d = new Date(date);

  return (
    d.toLocaleDateString("fr-FR") +
    " " +
    d.toLocaleTimeString(
      "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    )
  );

}

/* ================================
   NORMALISATION
================================ */

function normalizeItems(items = []) {

  return items.map((item) => ({

    name:
      item.name || "Produit",

    qty:
      Number(
        item.qty ??
        item.quantity ??
        0
      ),

    price:
      Number(
        item.price ?? 0
      )

  }));

}

/* ================================
   TEXTE COURT
================================ */

function shortText(text, max = 16) {

  const value =
    String(text || "");

  if (value.length <= max) {
    return value;
  }

  return (
    value.slice(0, max - 1) + "…"
  );

}

/* ================================
   QR STYLE SIMPLE
================================ */

function drawQr(doc, x, y) {

  const cell = 3;

  const pattern = [

    "11111100",
    "10000100",
    "10110100",
    "10110100",
    "10000100",
    "11111100",
    "00000000",
    "00111000"

  ];

  pattern.forEach((row, rowIndex) => {

    row.split("").forEach((col, colIndex) => {

      if (col === "1") {

        doc.rect(
          x + (colIndex * cell),
          y + (rowIndex * cell),
          cell,
          cell,
          "F"
        );

      }

    });

  });

}

/* ================================
   SÉPARATEUR
================================ */

function drawSeparator(doc, y) {

  doc.setLineWidth(0.3);

  doc.line(
    LEFT,
    y,
    RIGHT,
    y
  );

}

/* ================================
   CALCUL HAUTEUR
================================ */

function calculateHeight(itemsCount) {

  return (
    250 +
    (itemsCount * 16)
  );

}

/* ================================
   DESSIN TICKET
================================ */

function drawReceipt(
  doc,
  data,
  logo
) {

  let y = 10;

  /* ================================
     LOGO
  ================================= */

  if (logo) {

    doc.addImage(
      logo,
      "PNG",
      88,
      y,
      50,
      28
    );

    y += 34;

  }

  /* ================================
     ENTÊTE
  ================================= */

  doc.setFont(
    FONT_FAMILY,
    "bold"
  );

  doc.setFontSize(
    FONT_SIZE_TITLE
  );

  doc.text(
    SHOP_NAME,
    TICKET_WIDTH / 2,
    y,
    {
      align: "center"
    }
  );

  y += 10;

  doc.setFont(
    FONT_FAMILY,
    "normal"
  );

  doc.setFontSize(
    FONT_SIZE_SMALL
  );

  doc.text(
    SHOP_ADDRESS,
    TICKET_WIDTH / 2,
    y,
    {
      align: "center"
    }
  );

  y += 8;

  doc.text(
    `Tel : ${SHOP_PHONE}`,
    TICKET_WIDTH / 2,
    y,
    {
      align: "center"
    }
  );

  y += 10;

  drawSeparator(doc, y);

  y += 10;

  /* ================================
     INFOS REÇU
  ================================= */

  doc.setFontSize(
    FONT_SIZE_NORMAL
  );

  doc.text(
    `Reçu : ${data.saleId}`,
    LEFT,
    y
  );

  y += 10;

  doc.text(
    `Date : ${formatDate(data.date)}`,
    LEFT,
    y
  );

  y += 10;

  doc.text(
    `Client : ${
      data.name ||
      "Client direct"
    }`,
    LEFT,
    y
  );

  y += 10;

  if (data.offline) {

    doc.setFont(
      FONT_FAMILY,
      "bold"
    );

    doc.text(
      "MODE HORS LIGNE",
      LEFT,
      y
    );

    doc.setFont(
      FONT_FAMILY,
      "normal"
    );

    y += 10;

  }

  drawSeparator(doc, y);

  y += 10;

  /* ================================
     TITRES TABLEAU
  ================================= */

  doc.setFont(
    FONT_FAMILY,
    "bold"
  );

  doc.text(
    "Produit",
    LEFT,
    y
  );

  doc.text(
    "Qté",
    120,
    y,
    {
      align: "right"
    }
  );

  doc.text(
    "PU",
    165,
    y,
    {
      align: "right"
    }
  );

  doc.text(
    "Total",
    RIGHT,
    y,
    {
      align: "right"
    }
  );

  y += 8;

  drawSeparator(doc, y);

  y += 10;

  /* ================================
     PRODUITS
  ================================= */

  doc.setFont(
    FONT_FAMILY,
    "normal"
  );

  data.items.forEach((item) => {

    const total =
      item.qty * item.price;

    doc.text(
      shortText(item.name, 14),
      LEFT,
      y
    );

    doc.text(
      String(item.qty),
      120,
      y,
      {
        align: "right"
      }
    );

    doc.text(
      item.price.toFixed(0),
      165,
      y,
      {
        align: "right"
      }
    );

    doc.text(
      total.toFixed(0),
      RIGHT,
      y,
      {
        align: "right"
      }
    );

    y += 14;

  });

  drawSeparator(doc, y);

  y += 14;

  /* ================================
     TOTAL
  ================================= */

  doc.setFont(
    FONT_FAMILY,
    "bold"
  );

  doc.setFontSize(
    FONT_SIZE_TOTAL
  );

  doc.text(
    `TOTAL : ${data.total.toFixed(0)} FC`,
    RIGHT,
    y,
    {
      align: "right"
    }
  );

  y += 14;

  drawSeparator(doc, y);

  y += 14;

  /* ================================
     PAIEMENT
  ================================= */

  doc.setFontSize(
    FONT_SIZE_NORMAL
  );

  const paid =
    Number(
      data.amountPaid ||
      data.total
    );

  const remaining =
    Number(
      data.remaining || 0
    );

  const status =
    data.paymentMode === "partial"
      ? "Partiel"
      : "Payé";

  doc.text(
    `Payé : ${paid.toFixed(0)} FC`,
    LEFT,
    y
  );

  y += 10;

  doc.text(
    `Reste : ${remaining.toFixed(0)} FC`,
    LEFT,
    y
  );

  y += 10;

  doc.text(
    `Statut : ${status}`,
    LEFT,
    y
  );

  y += 14;

  drawSeparator(doc, y);

  y += 14;

  /* ================================
     QR
  ================================= */

  drawQr(
    doc,
    90,
    y
  );

  y += 34;

  /* ================================
     MESSAGE
  ================================= */

  doc.setFont(
    FONT_FAMILY,
    "normal"
  );

  doc.setFontSize(
    FONT_SIZE_SMALL
  );

  doc.text(
    "Merci pour votre achat",
    TICKET_WIDTH / 2,
    y,
    {
      align: "center"
    }
  );

  y += 8;

  doc.text(
    "ES-SHOP",
    TICKET_WIDTH / 2,
    y,
    {
      align: "center"
    }
  );

}

/* ================================
   EXPORT PRINCIPAL
================================ */

export async function generateReceipt(rawData) {

  if (
    !rawData ||
    !rawData.items
  ) {

    console.error(
      "Données invalides"
    );

    return;

  }

  const items =
    normalizeItems(
      rawData.items
    );

  const total =
    Number(
      rawData.total ??
      items.reduce(
        (sum, item) => {

          return (
            sum +
            (
              item.qty *
              item.price
            )
          );

        },
        0
      )
    );

  const data = {

    ...rawData,

    items,

    total

  };

  const ticketHeight =
    calculateHeight(
      data.items.length
    );

  const doc =
    new jsPDF({

      unit: "pt",

      format: [
        TICKET_WIDTH,
        ticketHeight
      ]

    });

  const logo =
    await loadImage(
      logoUrl
    );

  drawReceipt(
    doc,
    data,
    logo
  );

  doc.save(
    `recu_${data.saleId}.pdf`
  );

   }

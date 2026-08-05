// Web Bluetooth ESC/POS Drucker-Anbindung
//
// WICHTIG: Bixolon-Mobildrucker unterstützen je nach Modell entweder:
//  a) Bluetooth Low Energy (BLE) -> funktioniert direkt mit dieser Web Bluetooth API
//  b) Klassisches Bluetooth SPP  -> Web Bluetooth kann das NICHT ansprechen,
//     dafür braucht es die Bixolon-eigene App/SDK oder eine native Wrapper-App.
//
// Sobald das genaue Modell feststeht, muss ggf. die SERVICE_UUID / CHARACTERISTIC_UUID
// angepasst werden (auf der Bixolon-Doku bzw. per BLE-Scan-Tool auslesen).

// Platzhalter-UUIDs für generische ESC/POS-BLE-Drucker (z.B. viele Chinesische Module
// nutzen diese "049..." UUIDs - beim echten Gerät ggf. austauschen)
const SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

let device = null;
let characteristic = null;

export function isWebBluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export async function connectPrinter() {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      'Web Bluetooth wird von diesem Browser nicht unterstützt. Bitte Chrome am Handy verwenden.'
    );
  }
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID],
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
  return device.name || 'Drucker';
}

export function disconnectPrinter() {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }
  device = null;
  characteristic = null;
}

export function isPrinterConnected() {
  return !!characteristic;
}

// ---- ESC/POS Hilfsbefehle ----
const ESC = 0x1b;
const GS = 0x1d;

function textToBytes(text) {
  // einfache Codepage-Annäherung, ä/ö/ü ersetzen falls Drucker keine Umlaute kann
  return new TextEncoder().encode(text);
}

function buildReceipt({ eventName, fridgeLabel, timestamp, entries, diffWarnings }) {
  const lines = [];
  const cmd = (arr) => lines.push(Uint8Array.from(arr));

  cmd([ESC, 0x40]); // init
  cmd([ESC, 0x61, 0x01]); // center align
  lines.push(textToBytes(`Festwerk - Standzettel\n`));
  cmd([ESC, 0x61, 0x00]); // left align
  lines.push(textToBytes(`${eventName}\n`));
  lines.push(textToBytes(`${fridgeLabel}  ${new Date(timestamp).toLocaleString('de-AT')}\n`));
  lines.push(textToBytes('--------------------------------\n'));

  for (const e of entries) {
    const name = e.productName.length > 18 ? e.productName.slice(0, 18) : e.productName;
    const totalStr = String(e.total).padStart(5, ' ');
    lines.push(textToBytes(`${name.padEnd(19, ' ')}${totalStr}\n`));
  }

  if (diffWarnings?.length) {
    lines.push(textToBytes('--------------------------------\n'));
    lines.push(textToBytes('ACHTUNG - Differenz zur Nacht:\n'));
    for (const w of diffWarnings) {
      lines.push(textToBytes(`${w.productName}: ${w.diff}\n`));
    }
  }

  lines.push(textToBytes('--------------------------------\n'));
  lines.push(textToBytes('\n\n\n'));
  cmd([GS, 0x56, 0x00]); // cut

  // alles zu einem Buffer zusammenfassen
  const totalLen = lines.reduce((sum, l) => sum + l.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const l of lines) {
    out.set(l, offset);
    offset += l.length;
  }
  return out;
}

export async function printReceipt(data) {
  if (!characteristic) {
    throw new Error('Kein Drucker verbunden. Zuerst "Drucker verbinden" tippen.');
  }
  const payload = buildReceipt(data);
  // in Chunks senden, viele BLE-Charakteristiken erlauben max ~180-512 Byte pro Write
  const CHUNK = 180;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    await characteristic.writeValueWithoutResponse
      ? characteristic.writeValueWithoutResponse(chunk)
      : characteristic.writeValue(chunk);
    // kleine Pause, damit der Drucker-Puffer mitkommt
    await new Promise((r) => setTimeout(r, 20));
  }
}

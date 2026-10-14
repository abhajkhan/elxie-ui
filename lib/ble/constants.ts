export const BLE_SERVICE_UUID =
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

export const BLE_RX_CHARACTERISTIC_UUID =
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

export const BLE_TX_CHARACTERISTIC_UUID =
  "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

export const BLE_DEVICE_NAME = "ELXIE";

// Elxie Blocks VM service (binary frames, see public/elxie-blocks/js/link.js).
// Optional: only present on firmware that bundles the block-program runtime.
export const BLE_VM_SERVICE_UUID =
  "8d3a0001-5e1c-4a8e-9b2d-e1a1e0c0de01";

export const BLE_VM_RX_CHARACTERISTIC_UUID =
  "8d3a0002-5e1c-4a8e-9b2d-e1a1e0c0de01";

export const BLE_VM_TX_CHARACTERISTIC_UUID =
  "8d3a0003-5e1c-4a8e-9b2d-e1a1e0c0de01";

// Matches the 20-byte chunking used by Elxie Blocks' own BLE transport.
export const BLE_VM_CHUNK_SIZE = 20;

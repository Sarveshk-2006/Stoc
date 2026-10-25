import rawSeed from '../data/seedData.json';

const seedData = rawSeed as any;

export function clientResolveQr(code: string): any {
  const org_id = 'org_triwiz_01';
  let query_str = (code || '').trim();

  // 0. Opaque URL extraction if scanned from camera or Google Lens as a web link
  if (query_str.startsWith('http://') || query_str.startsWith('https://')) {
    try {
      const url = new URL(query_str);
      if (url.searchParams.has('code')) query_str = url.searchParams.get('code')!.trim();
      else if (url.searchParams.has('id')) query_str = url.searchParams.get('id')!.trim();
      else if (url.searchParams.has('batch')) query_str = url.searchParams.get('batch')!.trim();
      else if (url.searchParams.has('sku')) query_str = url.searchParams.get('sku')!.trim();
      else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 0) query_str = parts[parts.length - 1].trim();
      }
    } catch {
      // url parse fallback
    }
  }

  // Strip standard prefixes
  let normalized_lookup = query_str;
  for (const prefix of ['PROD:', 'SKU:', 'BATCH:', 'LOT:', 'TRF:', 'TRANSFER:']) {
    if (normalized_lookup.toUpperCase().startsWith(prefix)) {
      normalized_lookup = normalized_lookup.slice(prefix.length).trim();
      break;
    }
  }

  const destinations = Object.values(seedData.destinations || {});
  const warehouses = Object.values(seedData.warehouses || {}) as any[];
  const defaultWarehouse = warehouses.find((w: any) => w.id === 'wh_mumbai_hub' || w.id === 'wh_chicago_01') || warehouses[0] || {};

  // 1. Check Transfer
  let transfer_lookup = normalized_lookup;
  if (query_str.includes('STOCKPILOT://TRANSFER/')) {
    const parts = query_str.split('/');
    transfer_lookup = parts[3] || normalized_lookup;
  }

  const transfers = Object.values(seedData.transfers || {}) as any[];
  const matchedTransfer = transfers.find((t: any) =>
    t.id === transfer_lookup || t.transfer_number === transfer_lookup
  );

  if (matchedTransfer) {
    const srcWh = seedData.warehouses?.[matchedTransfer.source_warehouse_id] || defaultWarehouse;
    const dstWh = seedData.warehouses?.[matchedTransfer.target_warehouse_id] || defaultWarehouse;
    const items = (matchedTransfer.items || []).map((itm: any) => {
      const p = seedData.products?.[itm.product_id];
      return {
        ...itm,
        product_name: p?.name || itm.product_id,
        product_sku: p?.sku || '',
        description: p?.description || 'Temperature-regulated clinical biological asset certified for fast-track distribution.',
      };
    });

    const movements = Object.values(seedData.inventory_movements || {}).slice(0, 10);

    return {
      resolved_type: 'transfer',
      transfer: matchedTransfer,
      transfer_id: matchedTransfer.id,
      status: matchedTransfer.status,
      source_warehouse: srcWh,
      target_warehouse: dstWh,
      destinations,
      items,
      product_name: items[0]?.product_name || 'Active Clinical Cargo',
      sku: items[0]?.product_sku || '',
      description: items[0]?.description || 'Certified pharmaceutical cargo under verified cold-chain protocol.',
      history: movements,
      movements,
      total_available: 1200,
    };
  }

  // 2. Check Batch
  let batch_num_lookup = normalized_lookup;
  if (query_str.includes('STOCKPILOT://BATCH/')) {
    const parts = query_str.split('/');
    batch_num_lookup = parts[3] || normalized_lookup;
  }

  const batches = Object.values(seedData.inventory_batches || {}) as any[];
  const matchedBatch = batches.find((b: any) =>
    (b.batch_number && b.batch_number.toUpperCase() === batch_num_lookup.toUpperCase()) ||
    b.id === batch_num_lookup ||
    b.qr_code_id === query_str ||
    (b.supplier_reference && b.supplier_reference.toUpperCase() === batch_num_lookup.toUpperCase())
  );

  if (matchedBatch) {
    const prd = seedData.products?.[matchedBatch.product_id];
    const wh = seedData.warehouses?.[matchedBatch.warehouse_id] || defaultWarehouse;
    const movements = (Object.values(seedData.inventory_movements || {}) as any[])
      .filter((m: any) => m.product_id === matchedBatch.product_id)
      .slice(0, 15);

    return {
      resolved_type: 'batch',
      batch: matchedBatch,
      product: prd,
      warehouse: wh,
      source_warehouse: wh,
      destinations,
      product_id: prd?.id || matchedBatch.product_id,
      product_name: prd?.name || matchedBatch.batch_number,
      sku: prd?.sku || '',
      description: prd?.description || 'High-priority clinical biological product certified for temperature-sensitive storage and rapid dispatch.',
      category: prd?.category || 'Pharmaceuticals',
      handling: prd?.handling || 'cold_chain',
      storage_type: prd?.handling || 'cold_chain',
      warehouse_id: matchedBatch.warehouse_id,
      batch_number: matchedBatch.batch_number,
      batch_id: matchedBatch.id,
      storage_bin: matchedBatch.storage_bin || 'BIN-A-01',
      expiry_date: matchedBatch.expiry_date,
      mfg_date: matchedBatch.mfg_date || '2026-01-15',
      supplier_reference: matchedBatch.supplier_reference || 'Serum Institute / Pfizer-BioNTech',
      unit_cost: matchedBatch.unit_cost || 22.50,
      current_stock: matchedBatch.quantity || 0,
      total_available: matchedBatch.quantity || 0,
      movements,
      history: movements,
      active_batches: [matchedBatch],
    };
  }

  // 3. Check Product
  let sku_lookup = normalized_lookup;
  if (query_str.includes('STOCKPILOT://SKU/')) {
    const parts = query_str.split('/');
    sku_lookup = parts[3] || normalized_lookup;
  }

  const products = Object.values(seedData.products || {}) as any[];
  const matchedPrd = products.find((p: any) =>
    (p.sku && p.sku.toUpperCase() === sku_lookup.toUpperCase()) ||
    p.id === sku_lookup ||
    p.barcode === query_str ||
    (p.name && p.name.toLowerCase().includes(sku_lookup.toLowerCase()))
  ) || products[0]; // fallback to first product if query is generic

  if (matchedPrd) {
    const activeBatches = batches.filter((b: any) => b.product_id === matchedPrd.id);
    const primaryBatch = activeBatches[0];
    const wh = primaryBatch
      ? (seedData.warehouses?.[primaryBatch.warehouse_id] || defaultWarehouse)
      : defaultWarehouse;

    const totalStock = activeBatches.reduce((acc: number, b: any) => acc + (b.quantity || 0), 0);
    const movements = (Object.values(seedData.inventory_movements || {}) as any[])
      .filter((m: any) => m.product_id === matchedPrd.id)
      .slice(0, 15);

    return {
      resolved_type: 'product',
      product: matchedPrd,
      product_id: matchedPrd.id,
      product_name: matchedPrd.name,
      sku: matchedPrd.sku,
      barcode: matchedPrd.barcode,
      description: matchedPrd.description || 'High-priority temperature-sensitive healthcare stock registered in enterprise supply grid.',
      category: matchedPrd.category,
      unit: matchedPrd.unit,
      unit_cost: matchedPrd.unit_cost,
      selling_price: matchedPrd.selling_price,
      reorder_point: matchedPrd.reorder_point,
      storage_type: matchedPrd.handling || 'cold_chain',
      handling: matchedPrd.handling || 'cold_chain',
      temp_range: matchedPrd.temp_range,
      source_warehouse: wh,
      warehouse: wh,
      destinations,
      active_batches: activeBatches.length > 0 ? activeBatches : [{
        id: 'btc_auto_01',
        batch_number: `LOT-${matchedPrd.sku}-2026`,
        expiry_date: '2026-12-31',
        quantity: totalStock || 450,
        storage_bin: 'BIN-COLD-01',
        status: 'active'
      }],
      batch: primaryBatch || null,
      batch_id: primaryBatch?.id || null,
      batch_number: primaryBatch?.batch_number || null,
      expiry_date: primaryBatch?.expiry_date || null,
      current_stock: totalStock || 450,
      total_available: totalStock || 450,
      movements,
      history: movements,
    };
  }

  throw new Error(`No product, batch, or transfer found matching: ${code}`);
}

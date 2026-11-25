// Reuse the reviewed slide renderer without changing the product-introduction artifacts.
process.env.PRESENTATION_DIR='documents/presentations/accelerator-ka';
await import('./build-product-presentation.mjs');

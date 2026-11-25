const lang=process.argv[2]||'ka';
if(!['ka','en'].includes(lang))throw Error('Choose ka or en');
process.env.PRESENTATION_LANGUAGE=lang;
process.env.PRESENTATION_DIR='documents/presentations/accelerator-'+lang;
await import('./build-product-presentation.mjs');

import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createLocationFulfillmentSetWorkflow,
  createPricePreferencesWorkflow,
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRatesWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/core-flows";
import { assertProductionPaymentConfigured, STORE_DEFAULTS } from "../config/store-defaults";

export default async function setupStore({
  container,
}: {
  container: MedusaContainer;
  args?: string[];
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK);
  logger.info("Starting idempotent Turkey store configuration (WooCommerce baseline)...");

  // Production Payment Provider Guard
  const paymentService = container.resolve(Modules.PAYMENT);
  const paymentProviders = await paymentService.listPaymentProviders({});
  const providerIds = paymentProviders.map((p: any) => p.id);
  assertProductionPaymentConfigured(providerIds, process.env.NODE_ENV);

  // 1. Store & Currency Configuration
  const storeService = container.resolve(Modules.STORE);
  const stores = await storeService.listStores();
  if (stores.length === 0) {
    throw new Error("No existing store found in Medusa database.");
  }
  const defaultStore = stores[0];

  logger.info(`Configuring Store: '${STORE_DEFAULTS.store.name}' (ID: ${defaultStore.id})...`);
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: defaultStore.id },
      update: {
        name: STORE_DEFAULTS.store.name,
        supported_currencies: [
          {
            currency_code: STORE_DEFAULTS.store.default_currency_code,
            is_default: true,
            is_tax_inclusive: true,
          },
        ],
      },
    },
  });

  // 2. Region & Tax-Inclusive Price Preference
  const regionService = container.resolve(Modules.REGION);
  const existingRegions = await regionService.listRegions({
    name: STORE_DEFAULTS.region.name,
  });

  let turkeyRegion: any = existingRegions[0];
  if (!turkeyRegion) {
    logger.info(`Creating Region '${STORE_DEFAULTS.region.name}' (TRY, country: tr)...`);
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: STORE_DEFAULTS.region.name,
            currency_code: STORE_DEFAULTS.region.currency_code,
            countries: STORE_DEFAULTS.region.countries,
            automatic_taxes: STORE_DEFAULTS.region.automatic_taxes,
          },
        ],
      },
    });
    turkeyRegion = result[0];
  } else {
    logger.info(`Region '${STORE_DEFAULTS.region.name}' already exists (ID: ${turkeyRegion.id}).`);
  }

  // Link region to payment provider for checkout
  if (providerIds.includes("pp_system_default") || providerIds.length > 0) {
    const devPaymentProvider = providerIds.includes("pp_system_default")
      ? "pp_system_default"
      : providerIds[0];
    try {
      await remoteLink.create([
        {
          [Modules.REGION]: {
            region_id: turkeyRegion.id,
          },
          [Modules.PAYMENT]: {
            payment_provider_id: devPaymentProvider,
          },
        },
      ]);
      logger.info(`Linked region to payment provider '${devPaymentProvider}'.`);
    } catch (err: any) {
      logger.debug(`Region payment link: ${err?.message || "ok"}`);
    }
  }

  // Price Preferences (tax-inclusive pricing)
  const pricingService = container.resolve(Modules.PRICING);
  const existingPreferences = await pricingService.listPricePreferences({});
  const hasCurrencyPref = existingPreferences.some(
    (p: any) => p.attribute === "currency_code" && p.value === "try",
  );
  const hasRegionPref = existingPreferences.some(
    (p: any) => p.attribute === "region_id" && p.value === turkeyRegion.id,
  );

  const newPrefs = [];
  if (!hasCurrencyPref) {
    newPrefs.push({
      attribute: "currency_code",
      value: "try",
      is_tax_inclusive: true,
    });
  }
  if (!hasRegionPref) {
    newPrefs.push({
      attribute: "region_id",
      value: turkeyRegion.id,
      is_tax_inclusive: true,
    });
  }

  if (newPrefs.length > 0) {
    logger.info("Creating tax-inclusive price preferences for TRY / Region...");
    await createPricePreferencesWorkflow(container).run({
      input: newPrefs,
    });
  }

  // 3. Tax Region & KDV Tax Rates (%20, %10, %1)
  const taxService = container.resolve(Modules.TAX);
  const existingTaxRegions = await taxService.listTaxRegions({
    country_code: "tr",
  });

  let turkeyTaxRegion: any = existingTaxRegions[0];
  if (!turkeyTaxRegion) {
    logger.info("Creating Tax Region for country 'tr' with default 20% KDV...");
    const { result } = await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "tr",
          provider_id: "tp_system",
          default_tax_rate: {
            name: "Standart KDV (%20)",
            code: "KDV20",
            rate: 20,
          },
        },
      ],
    });
    turkeyTaxRegion = result[0];
  } else {
    logger.info(`Tax Region for 'tr' already exists (ID: ${turkeyTaxRegion.id}).`);
    if (turkeyTaxRegion.provider_id !== "tp_system") {
      logger.info("Updating Tax Region provider_id to 'tp_system'...");
      turkeyTaxRegion = await taxService.updateTaxRegions({
        id: turkeyTaxRegion.id,
        provider_id: "tp_system",
      });
    }
  }

  // Product Types for KDV Rules (Gıda / Temel -> %10, Özel İndirimli -> %1)
  const productService = container.resolve(Modules.PRODUCT);
  const existingTypes = await productService.listProductTypes({});
  let foodType = existingTypes.find((t: any) => t.value === "food");
  if (!foodType) {
    foodType = await productService.createProductTypes({ value: "food" });
    logger.info(`Created product type 'food' (ID: ${foodType.id}).`);
  }
  let specialType = existingTypes.find((t: any) => t.value === "special");
  if (!specialType) {
    specialType = await productService.createProductTypes({ value: "special" });
    logger.info(`Created product type 'special' (ID: ${specialType.id}).`);
  }

  // Query existing rates for tax region
  const existingTaxRates = await taxService.listTaxRates({
    tax_region_id: turkeyTaxRegion.id,
  });

  const taxRatesToCreate: any[] = [];
  const hasKdv10 = existingTaxRates.some((r: any) => r.code === "KDV10");
  if (!hasKdv10) {
    taxRatesToCreate.push({
      tax_region_id: turkeyTaxRegion.id,
      name: "Gıda/Temel KDV (%10)",
      code: "KDV10",
      rate: 10,
      is_default: false,
      rules: [
        {
          reference: "product_type",
          reference_id: foodType.id,
        },
      ],
    });
  }

  const hasKdv1 = existingTaxRates.some((r: any) => r.code === "KDV1");
  if (!hasKdv1) {
    taxRatesToCreate.push({
      tax_region_id: turkeyTaxRegion.id,
      name: "Özel İndirimli KDV (%1)",
      code: "KDV1",
      rate: 1,
      is_default: false,
      rules: [
        {
          reference: "product_type",
          reference_id: specialType.id,
        },
      ],
    });
  }

  if (taxRatesToCreate.length > 0) {
    logger.info("Creating conditional KDV tax rates (%10 and %1)...");
    await createTaxRatesWorkflow(container).run({
      input: taxRatesToCreate,
    });
  }

  // 4. Sales Channel
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  let defaultSalesChannel: any = null;
  if (defaultStore.default_sales_channel_id) {
    defaultSalesChannel = await salesChannelService.retrieveSalesChannel(
      defaultStore.default_sales_channel_id,
    );
    if (defaultSalesChannel.name !== STORE_DEFAULTS.sales_channel.name) {
      logger.info(`Renaming default sales channel to '${STORE_DEFAULTS.sales_channel.name}'...`);
      defaultSalesChannel = await salesChannelService.updateSalesChannels(defaultSalesChannel.id, {
        name: STORE_DEFAULTS.sales_channel.name,
        description: STORE_DEFAULTS.sales_channel.description,
      });
    }
  } else {
    const existingChannels = await salesChannelService.listSalesChannels({
      name: STORE_DEFAULTS.sales_channel.name,
    });
    if (existingChannels.length > 0) {
      defaultSalesChannel = existingChannels[0];
    } else {
      defaultSalesChannel = await salesChannelService.createSalesChannels({
        name: STORE_DEFAULTS.sales_channel.name,
        description: STORE_DEFAULTS.sales_channel.description,
      });
    }
  }
  logger.info(
    `Sales channel ready: '${defaultSalesChannel.name}' (ID: ${defaultSalesChannel.id}).`,
  );

  // 5. Stock Location & Link to Sales Channel
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const existingLocations = await stockLocationService.listStockLocations({
    name: STORE_DEFAULTS.stock_location.name,
  });

  let mainLocation: any = existingLocations[0];
  if (!mainLocation) {
    logger.info(`Creating stock location '${STORE_DEFAULTS.stock_location.name}'...`);
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STORE_DEFAULTS.stock_location.name,
            address: STORE_DEFAULTS.stock_location.address,
          },
        ],
      },
    });
    mainLocation = result[0];
  } else {
    logger.info(`Stock location '${mainLocation.name}' already exists (ID: ${mainLocation.id}).`);
  }

  // Link stock location to sales channel
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: mainLocation.id,
        add: [defaultSalesChannel.id],
      },
    });
  } catch (err: any) {
    logger.debug(`Stock location sales channel link: ${err?.message || "ok"}`);
  }

  // Link stock location to fulfillment provider
  try {
    await remoteLink.create([
      {
        [Modules.STOCK_LOCATION]: {
          stock_location_id: mainLocation.id,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_provider_id: STORE_DEFAULTS.fulfillment.provider_id,
        },
      },
    ]);
    logger.info(`Linked stock location to provider '${STORE_DEFAULTS.fulfillment.provider_id}'.`);
  } catch (err: any) {
    logger.debug(`Stock location provider link: ${err?.message || "ok"}`);
  }

  // 6. Fulfillment Set, Service Zone & Shipping Profile
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);
  const existingSets = await fulfillmentService.listFulfillmentSets({
    name: "Türkiye Teslimat",
  });

  let fulfillmentSet: any = existingSets[0];
  if (!fulfillmentSet) {
    logger.info("Creating location fulfillment set 'Türkiye Teslimat'...");
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: mainLocation.id,
        fulfillment_set_data: {
          name: "Türkiye Teslimat",
          type: "shipping",
        },
      },
    });
    const sets = await fulfillmentService.listFulfillmentSets({
      name: "Türkiye Teslimat",
    });
    fulfillmentSet = sets[0];
  }

  // Service Zone for Turkey
  const existingZones = await fulfillmentService.listServiceZones({
    name: STORE_DEFAULTS.fulfillment.service_zone_name,
  });

  let serviceZone: any = existingZones[0];
  if (!serviceZone) {
    logger.info(`Creating service zone '${STORE_DEFAULTS.fulfillment.service_zone_name}'...`);
    const { result } = await createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            name: STORE_DEFAULTS.fulfillment.service_zone_name,
            fulfillment_set_id: fulfillmentSet.id,
            geo_zones: [
              {
                type: "country",
                country_code: "tr",
              },
            ],
          },
        ],
      },
    });
    serviceZone = result[0];
  } else {
    logger.info(`Service zone '${serviceZone.name}' already exists (ID: ${serviceZone.id}).`);
  }

  // Shipping Profile (Default)
  const existingProfiles = await fulfillmentService.listShippingProfiles({});
  let defaultProfile = existingProfiles.find(
    (p: any) => p.type === "default" || p.name === "Default" || p.name === "Varsayılan",
  );
  if (!defaultProfile) {
    if (existingProfiles.length > 0) {
      defaultProfile = existingProfiles[0];
    } else {
      defaultProfile = await fulfillmentService.createShippingProfiles({
        name: "Varsayılan",
        type: "default",
      });
    }
  }

  // Shipping Options (Standart, Ücretsiz >=1500, Mağazadan Teslim)
  const existingShippingOptions = await fulfillmentService.listShippingOptions({});
  const shippingOptionsToCreate: any[] = [];

  const standartOpt = existingShippingOptions.find((o: any) => o.name === "Standart Kargo");
  if (!standartOpt) {
    shippingOptionsToCreate.push({
      name: "Standart Kargo",
      service_zone_id: serviceZone.id,
      shipping_profile_id: defaultProfile.id,
      provider_id: STORE_DEFAULTS.fulfillment.provider_id,
      price_type: "flat",
      type: {
        label: "Standart",
        description: "Standart kargo teslimatı (89.90 TL)",
        code: "standard",
      },
      prices: [
        {
          currency_code: "try",
          amount: 89.9,
        },
      ],
      rules: [
        {
          attribute: "is_return",
          operator: "eq",
          value: "false",
        },
        {
          attribute: "enabled_in_store",
          operator: "eq",
          value: "true",
        },
      ],
    });
  }

  const ucretsizOpt = existingShippingOptions.find((o: any) => o.name === "Ücretsiz Kargo");
  if (!ucretsizOpt) {
    shippingOptionsToCreate.push({
      name: "Ücretsiz Kargo",
      service_zone_id: serviceZone.id,
      shipping_profile_id: defaultProfile.id,
      provider_id: STORE_DEFAULTS.fulfillment.provider_id,
      price_type: "flat",
      type: {
        label: "Ücretsiz",
        description: "1500 TL üzeri ücretsiz kargo",
        code: "free",
      },
      prices: [
        {
          currency_code: "try",
          amount: 0,
        },
      ],
      rules: [
        {
          attribute: "is_return",
          operator: "eq",
          value: "false",
        },
        {
          attribute: "enabled_in_store",
          operator: "eq",
          value: "true",
        },
        {
          attribute: "item_total",
          operator: "gte",
          value: "1500",
        },
      ],
    });
  }

  const teslimOpt = existingShippingOptions.find((o: any) => o.name === "Mağazadan Teslim");
  if (!teslimOpt) {
    shippingOptionsToCreate.push({
      name: "Mağazadan Teslim",
      service_zone_id: serviceZone.id,
      shipping_profile_id: defaultProfile.id,
      provider_id: STORE_DEFAULTS.fulfillment.provider_id,
      price_type: "flat",
      type: {
        label: "Mağaza Teslimat",
        description: "Mağazadan doğrudan teslim alma (Ücretsiz)",
        code: "pickup",
      },
      prices: [
        {
          currency_code: "try",
          amount: 0,
        },
      ],
      rules: [
        {
          attribute: "is_return",
          operator: "eq",
          value: "false",
        },
        {
          attribute: "enabled_in_store",
          operator: "eq",
          value: "true",
        },
      ],
    });
  }

  if (shippingOptionsToCreate.length > 0) {
    logger.info(`Creating ${shippingOptionsToCreate.length} shipping options...`);
    await createShippingOptionsWorkflow(container).run({
      input: shippingOptionsToCreate,
    });
  } else {
    logger.info("Shipping options already configured.");
  }

  // 7. Categories (Hierarchical: Giyim -> Üst Giyim / Alt Giyim, Aksesuar, Ev & Yaşam)
  const existingCategories = await productService.listProductCategories({});
  for (const catConfig of STORE_DEFAULTS.categories) {
    let parentCat = existingCategories.find((c: any) => c.handle === catConfig.slug);
    if (!parentCat) {
      const { result } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [
            {
              name: catConfig.name,
              handle: catConfig.slug,
              description: catConfig.description,
              is_active: true,
              is_internal: false,
            },
          ],
        },
      });
      parentCat = result[0];
      logger.info(`Created category '${catConfig.name}' (slug: ${catConfig.slug}).`);
    }

    if (catConfig.children && catConfig.children.length > 0) {
      for (const childConfig of catConfig.children) {
        const childCat = existingCategories.find((c: any) => c.handle === childConfig.slug);
        if (!childCat) {
          await createProductCategoriesWorkflow(container).run({
            input: {
              product_categories: [
                {
                  name: childConfig.name,
                  handle: childConfig.slug,
                  description: childConfig.description,
                  parent_category_id: parentCat.id,
                  is_active: true,
                  is_internal: false,
                },
              ],
            },
          });
          logger.info(`Created subcategory '${childConfig.name}' (parent: ${catConfig.name}).`);
        }
      }
    }
  }

  // 8. Collections (Yeni Gelenler, İndirimdekiler) & Tags
  const existingCollections = await productService.listProductCollections({});
  for (const colConfig of STORE_DEFAULTS.collections) {
    const existingCol = existingCollections.find((c: any) => c.handle === colConfig.slug);
    if (!existingCol) {
      await createCollectionsWorkflow(container).run({
        input: {
          collections: [
            {
              title: colConfig.name,
              handle: colConfig.slug,
            },
          ],
        },
      });
      logger.info(`Created collection '${colConfig.name}' (handle: ${colConfig.slug}).`);
    }
  }

  // Tags
  const existingTags = await productService.listProductTags({});
  for (const tagConfig of STORE_DEFAULTS.tags) {
    const existingTag = existingTags.find((t: any) => t.value === tagConfig.value);
    if (!existingTag) {
      await productService.createProductTags([tagConfig]);
      logger.info(`Created product tag '${tagConfig.value}'.`);
    }
  }

  // 9. Publishable API Key
  const apiKeyService = container.resolve(Modules.API_KEY);
  const existingKeys = await apiKeyService.listApiKeys({
    title: STORE_DEFAULTS.publishable_api_key.title,
    type: "publishable",
  });

  let publishableKey: any = existingKeys[0];
  if (!publishableKey) {
    logger.info("Generating Publishable API Key for Web Mağaza...");
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            type: "publishable",
            title: STORE_DEFAULTS.publishable_api_key.title,
            created_by: "system_setup",
          },
        ],
      },
    });
    publishableKey = result[0];
  }

  // Link Publishable Key to Sales Channel
  try {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableKey.id,
        add: [defaultSalesChannel.id],
      },
    });
  } catch (err: any) {
    logger.debug(`API key sales channel link: ${err?.message || "ok"}`);
  }

  // Print Setup Summary and Publishable Key Token to stdout
  console.log("\n=======================================================");
  console.log(" STORE SETUP COMPLETED SUCCESSFULLY");
  console.log("=======================================================");
  console.log(`Store Name:            ${STORE_DEFAULTS.store.name}`);
  console.log(
    `Currency:              ${STORE_DEFAULTS.store.default_currency_code.toUpperCase()} (Tax-Inclusive)`,
  );
  console.log(`Region:                ${turkeyRegion.name} (${turkeyRegion.id})`);
  console.log(`Sales Channel:         ${defaultSalesChannel.name} (${defaultSalesChannel.id})`);
  console.log(`Stock Location:        ${mainLocation.name} (${mainLocation.id})`);
  console.log(`Publishable API Key:   ${publishableKey.token}`);
  console.log("=======================================================\n");

  logger.info("Setup finished idempotently.");
}

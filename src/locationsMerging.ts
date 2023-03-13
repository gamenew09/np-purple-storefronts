import { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';
import locations from './assets/locations.json';
import { Database } from './database.types';
import { StorefrontRow } from './dbtypes';

export function getAllCategories() {
    return [...new Set(locations.map((location) => location.type))];
}

export async function addNonexistingCategories(supabase: SupabaseClient<Database>) {
    const categories = getAllCategories();

    const {data, error} = await supabase.from('storefront_categories').select('*');

    if(error !== null) throw error;

    const nonaddedCategories = getAllCategories().filter((catName) => data.find((cat) => cat.title === catName) === undefined);

    const {error: error2} = await supabase.from('storefront_categories').insert(nonaddedCategories.map((catName) => ({
        title: catName,
        is_general: catName.toLowerCase() === "general"
    })));

    if(error2 !== null) throw error2;
}

export async function getDbCategories(supabase: SupabaseClient<Database>) {
    const {data, error} = await supabase.from('storefront_categories').select('*');
    if(error !== null) throw error;

    return data;
}

export async function addNonexistingLocations(supabase: SupabaseClient<Database>) {
    const {data, error} = await supabase.from('storefronts').select('*');
    if(error !== null) throw error;

    const categories = await getDbCategories(supabase);

    const nonaddedStorefronts = locations.filter((storefront) => data.find((dbStorefront) => dbStorefront.title === storefront.title) === undefined);

    const {error: error2} = await supabase.from('storefronts').insert(nonaddedStorefronts.map((storefront) => ({
        title: storefront.title,
        category: categories.find((cat) => cat.title === storefront.type)?.id,
        location: {lat: storefront.latlngarray[0].lat, lng: storefront.latlngarray[0].lng},
        description: storefront.notes,
        published: true,
    })))

    if(error2 !== null) throw error2;
}

function getResultOrError<T>(t: PostgrestSingleResponse<T>): T {
    if(t.error !== null) throw t.error;
    return t.data;
}

/*
INSERT INTO storefronts (id, title, location, description, category, published) VALUES ('75b4a15f-70e5-418b-be88-60994b16c939',
    'Nailed It Hardware',
    '{"lat": -70.767,"lng": -47.72}',
    'Sells advanced & regular lock picks, coffee, Drills, Heavy Cutters, Paint Thinner, Heavy Duty Drill, Screwdrivers, Trowels, and the Pail & Shovel.',
    '3961dd97-8c71-4f4e-be49-e192e8cc75a6',
    true);
*/

export async function buildSeedQueries(supabase: SupabaseClient<Database>) {
    const dbStorefronts = getResultOrError(await supabase.from('storefronts').select('*'));
    const categories = await getDbCategories(supabase);

    const singleQuoteReg = /[']/g;

    console.log(categories.map(({id, title, is_general}) => (`INSERT INTO storefront_categories (id, title, is_general) VALUES ('${id}', '${title}', ${is_general ? "true" : "false"});`)).reduce((prev, cur) => (prev + cur + "\n")), '');

    console.log(dbStorefronts.map(({id, title, location, description, category, published}) => (`INSERT INTO storefronts (id, title, location, description, category, published) VALUES ('${id}',
        '${title.replace(singleQuoteReg, "''")}',
        '${JSON.stringify(location)}',
        '${description?.replace(singleQuoteReg, "''") ?? "null"}',
        '${category ?? "null"}',
        ${published ? 'true' : 'false'});`)).reduce((prev, cur) => ((prev ?? '') + cur + "\n")));

    const storefrontTitleToIdMap = new Map<string, string>();
    
    dbStorefronts.forEach((storefront) => {
        storefrontTitleToIdMap.set(storefront.title, storefront.id);
    });

    const images = locations.map((loc) => loc.images.map((img) => ({...img, storefrontId: storefrontTitleToIdMap.get(loc.title)}))).reduce((prev, cur) => {
        prev.push(...cur);
        return prev;
    }, []);
    
    console.log(images.map(({storefrontId, url, credits, headline}) => (`INSERT INTO storefront_images (storefront_id, image_url, description, credits) VALUES ('${storefrontId}', '${url}', '${headline.replace(/[']/g, "''")}', '${credits.replace(/[']/g, "''")}')`)).reduce((prev, cur) => (prev + cur + '\n'), ''));
}
import L from "leaflet";
import { useEffect, useRef, useCallback, useState } from "react";
import { MapContainer, LayersControl, TileLayer, LayerGroup, Marker, Popup } from "react-leaflet";
import type { Database, Json } from "./database.types";
import type {StorefrontRow, StorefrontCategoryRow, StorefrontImageRow} from "./dbtypes";

import location_pin from './assets/location-pin-50-filled.png'
import Button from "./components/Button";
import InputGroup from "./components/InputGroup";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { toast } from "react-hot-toast";
import React from "react";
import ReactDOM from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { findIconDefinition, parse } from "@fortawesome/fontawesome-svg-core";
import DialogStyled from "./components/Dialog";
import { Dialog } from "@headlessui/react";
import { PostgrestSingleResponse } from "@supabase/supabase-js";
import defaultIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import defaultIconUrl from "leaflet/dist/images/marker-icon.png";
import defaultShadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: defaultIconRetinaUrl,
  iconUrl: defaultIconUrl,
  shadowUrl: defaultShadowUrl
});

function assertJsonLocation(locationJson: Json): L.LatLngExpression {
    console.assert(typeof locationJson === "object");

    const {lat, lng} = (locationJson as {[key: string]: Json});

    console.assert(typeof lat === 'number');
    console.assert(typeof lng === 'number');

    return [lat as number, lng as number];
}

interface StorefrontEditFormProps {
  storefront: StorefrontRow;
  category?: StorefrontCategoryRow;
  categories: StorefrontCategoryRow[];
  disableEditMode: () => void;
  onSubmit: (changedRows: Partial<StorefrontRow>) => void;
}

function StorefrontEditForm({storefront, category, disableEditMode, onSubmit, categories}: StorefrontEditFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<StorefrontRow["category"]>(category?.id ?? null);

  const [title, setTitle] = useState(storefront.title);
  const [description, setDescription] = useState(storefront.description ?? '');

  const [error, setError] = useState<string>();

  const hasAnythingChanged = useCallback(() => {
    if(title !== storefront.title) {
      return true;
    }

    if(selectedCategory !== category?.id) {
      return true;
    }

    if(description !== storefront.description) {
      return true;
    }
    return false;
  }, [title, selectedCategory, description]);

  return <div className="text-white flex flex-col gap-2">
    {
      error !== undefined ? (<div className="alert alert-error shadow-lg">
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error! {error}</span>
      </div>
    </div>) : undefined
    }
    <InputGroup size="sm">
      <span>Title</span>
      <input 
        onChange={(ev) => setTitle(ev.target.value)}
        type="text"
        placeholder='Storefront Title'
        defaultValue={storefront.title ?? undefined}
        className='input input-bordered input-sm' />
    </InputGroup>
    <InputGroup size="sm">
      <span>Category</span>
      <select onChange={(ev) => setSelectedCategory(ev.target.value === "" ? null : ev.target.value)} className='select select-bordered select-sm' defaultValue={category?.id ?? undefined}>
        <option disabled value="">Select Category</option>
        {categories?.map((category) => (<option value={category.id}>{category.title}</option>))}
      </select>
    </InputGroup>
    <textarea onChange={(ev) => setDescription(ev.target.value)} placeholder='Storefront Description' className='textarea textarea-bordered textarea-xs h-28' defaultValue={storefront.description ?? undefined}></textarea>
    <div className="flex gap-1 flex-row-reverse">
      <button className='btn btn-xs btn-primary' disabled={!hasAnythingChanged()} onClick={async (ev) => {
        ev.stopPropagation();

        try {
          if(/^$/.exec(title)) {
            throw "Title must not be empty.";
          }
          if(/^$/.exec(description)) {
            throw "Description must not be empty.";
          }
          if(selectedCategory === undefined) {
            throw "You must select a category.";
          }

          let changed: Partial<StorefrontRow> = {};
          if(title !== storefront.title) {
            changed.title = title;
          }

          if(selectedCategory !== category?.id) {
            changed.category = selectedCategory;
          }

          if(description !== storefront.description) {
            changed.description = description;
          }

          if(Object.keys(changed).length === 0) {
            throw "Nothing has been changed for publishing.";
          }

          await onSubmit(changed);
          setError(undefined);
        } catch (error) {
          setError(String(error));
          console.error(error);
        }
      }}>Submit</button>
      <button className='btn btn-xs' onClick={(ev) => {
        ev.stopPropagation();
        disableEditMode();
      }}>Cancel</button>
    </div>
  </div>
}

interface StorefrontMarkerProps {
  isEditMode: boolean;
  storefront: StorefrontRow;
  category: StorefrontCategoryRow;
  map: L.Map | null;

  allCategories: Array<StorefrontCategoryRow>;

  onDeleteClick: () => void;
  onStorefrontEdited: (id: string, changed: Partial<StorefrontRow>) => void;
}

interface StorefrontImageModalProps {
  image: StorefrontImageRow;
  storefront: StorefrontRow;

  open: boolean;
  onClose: () => void;
}

function StorefrontImageModal({image, storefront, onClose, open}: StorefrontImageModalProps) {
  return <DialogStyled 
    onClose={onClose}
    open={open}
    showCloseCross={true}
    titleClassName={`font-bold text-3xl`}
    title={`${storefront.title} Storefront Image`}
    description={<>
      <p className="text-2xl font-bold">{image.description ?? "Storefront Image Uncaptioned."}</p>
      <p className="text-sm">{image.credits ? `Photo taken by ${image.credits}.` : ""}</p>
    </>}
    panelClassName={`w-11/12 max-w-5xl`}
    descriptionPosition="bottom">
    <img tabIndex={1} className="pt-4" src={image.image_url ?? ""} alt={image.description ?? "Storefront Image Uncaptioned."}/>
  </DialogStyled>
}

interface StorefrontImageModifyModalProps {
  image?: StorefrontImageRow;
  storefront: StorefrontRow;

  open: boolean;
  onClose: () => void;

  modifyMode: "change" | "create";

  onModifyDone: (changed: Partial<Pick<StorefrontImageRow, "image_url" | "description" | "credits">>) => void;
}

function httpGetPromise(url: string): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const http = new XMLHttpRequest();
    http.onreadystatechange = () => {
      if(http.readyState === 4) {
        if(http.status === 200) {
          resolve(http);
        } else {
          reject(http);
        }
      }
    };
    http.open("GET", url, true);
    http.send(null);
  });
}

function StorefrontImageModifyModal({image, storefront, onClose, open, modifyMode, onModifyDone}: StorefrontImageModifyModalProps) {
  const supabase = useSupabaseClient<Database>();

  const [newImageUrl, setNewImageUrl] = useState(image?.image_url);
  const [newDescription, setNewDescription] = useState(image?.description);
  const [newCredits, setNewCredits] = useState(image?.credits);

  const [error, setError] = useState<string>();

  const onSubmitPromisified = useCallback(async () => {
    if(newImageUrl == null || /^$/.exec(newImageUrl)) {
      throw "Image URL must not be empty.";
    }

    // I'm considering using buckets instead because of the way we are checking the image url.
    try {
      const http = await httpGetPromise(newImageUrl);
    } catch (error) {
      throw "Image seems to be invalid."
    }

    
    if(/^$/.exec(newDescription ?? "")) {
      throw "Description must not be empty.";
    }
    if(/^$/.exec(newCredits ?? "")) {
      throw "Credits must not be empty.";
    }

    let changed: Partial<Pick<StorefrontImageRow, "image_url" | "description" | "credits">> = {};

    if(newImageUrl !== image?.image_url) {
      changed.image_url = newImageUrl;
    }

    if(newDescription !== image?.description) {
      changed.description = newDescription;
    }

    if(newCredits !== image?.credits) {
      changed.credits = newCredits;
    }

    if(Object.keys(changed).length === 0) {
      throw "Nothing has been changed."
    }

    let resp: PostgrestSingleResponse<unknown>;

    if(modifyMode === "change") {
      resp = await supabase.from('storefront_images').update(changed).eq('id', image?.id);
    } else if(modifyMode === "create") {
      resp = await supabase.from('storefront_images').insert({
        ...changed,
        storefront_id: storefront.id,
      });
    } else {
      throw "Invalid modifyMode";
    }

    const {error} = resp;
    if(error !== null) {
      console.error(error);
      if(error.code === "42501") {
        throw "Insufficient permissions."
      }

      throw "An unknown error occured";
    }

    return changed;
  }, [newImageUrl, newDescription, newCredits]);

  return <DialogStyled 
    onClose={onClose}
    open={open}
    showCloseCross={true}
    titleClassName={`font-bold text-3xl`}
    title={`${storefront.title} Storefront Image`}
    description={`Editing image for ${storefront.title ?? storefront.id}`}>
    <h2 className="font-bold text-2xl">Image Preview</h2>
    <img tabIndex={1} className="pt-4" src={newImageUrl ?? ""} alt={newDescription ?? "Storefront Image Uncaptioned."}/>
    {
      error !== undefined ? (<div className="alert alert-error shadow-lg mt-4">
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error! {error}</span>
      </div>
    </div>) : undefined
    }
    <InputGroup label="Image URL">
      <input 
        className="input input-bordered"
        type="text"
        name="imageurl"
        placeholder="Image URL"
        defaultValue={newImageUrl ?? undefined}
        onChange={(ev) => setNewImageUrl(ev.target.value)}
        />
    </InputGroup>
    <InputGroup label="Description">
      <textarea 
        className="textarea textarea-bordered"
        name="description"
        placeholder="Description"
        defaultValue={newDescription ?? undefined}
        onChange={(ev) => setNewDescription(ev.target.value)}
        ></textarea>
    </InputGroup>
    <InputGroup label="Photographer">
      <input 
        className="input input-bordered"
        type="text"
        name="credits"
        placeholder="Image URL"
        defaultValue={newCredits ?? undefined}
        onChange={(ev) => setNewCredits(ev.target.value)}
        />
    </InputGroup>
    <div className="modal-action">
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className={`btn btn-${modifyMode === "change" ? "primary" : "accent"}`} onClick={() => {
        onSubmitPromisified().then((changed) => {
          onModifyDone(changed);
          onClose();
        }).catch((reason) => setError(String(reason)));
      }}>{modifyMode === "change" ? "Update" : "Create"}</button>
    </div>
  </DialogStyled>
}

function StorefrontImageCarousel({images, editing, storefront, refreshImages}: {images: Array<StorefrontImageRow>; editing: boolean; storefront: StorefrontRow; refreshImages: () => void}) {
  const imageCount = images.length;

  const supabase = useSupabaseClient<Database>();

  const [selectedImage, setSelectedImage] = useState<StorefrontImageRow>();
  const [editingImage, setEditingImage] = useState<StorefrontImageRow | "create">();

  return <>
  {selectedImage !== undefined ? (<StorefrontImageModal image={selectedImage} storefront={storefront} open={selectedImage !== undefined} onClose={() => setSelectedImage(undefined)}/>) : undefined}
  {editingImage !== undefined ? (<StorefrontImageModifyModal modifyMode={editingImage === "create" ? "create" : "change"} image={editingImage === "create" ? undefined : editingImage} storefront={storefront} open={editingImage !== undefined} onClose={() => setEditingImage(undefined)} onModifyDone={() => refreshImages()}/>) : undefined}
  <div className="carousel w-full rounded-md">
    {images.map((image, index) => {
      let previousSlide = index - 1;
      let nextSlide = index + 1;

      if(previousSlide < 0) {
        previousSlide = imageCount - 1;
      }

      if(nextSlide > imageCount - 1) {
        nextSlide = 0;
      }

      const hasDescOrCredits = image.description !== undefined || image.credits !== undefined;

      const deleteImage = async () => {
        const {error} = await supabase.from('storefront_images').delete().eq('id', image.id);
        if(error !== null) {
          console.error(error);
          if(error.code === "42501") {
            throw "Insufficient permissions."
          }
    
          throw "An unknown error occured";
        }
      };

      return <div id={`slide-${index}`} className="carousel-item relative w-full">
        <div className="flex flex-col">
          <img src={image.image_url ?? ""} className="w-full cursor-zoom-in" onClick={(ev) => {
            ev.stopPropagation();
            // TODO: Show modal with the image and info in better detail.
            setSelectedImage(image);
          }} />
          {hasDescOrCredits ? (
            <div className="text-white w-full h-fit p-2 bg-black flex flex-col gap-2 items-center">
              {image.description ? <div className="text-lg">{image.description}</div> : undefined}
              {image.credits ? <div className="">Taken by {image.credits}</div> : undefined}
            </div>
          ) : undefined}
        </div>
        {editing ? (<div className="absolute flex flex-row-reverse inset-1 gap-2">
          <span className="text-lg text-error hover:text-accent-focus cursor-pointer w-fit h-fit" onClick={(ev) => {
            ev.stopPropagation();
            // TODO: Modal for verifying image being deleted.

            toast.promise(deleteImage().then(refreshImages), {
              error: (error) => String(error),
              loading: `Deleting Storefront Image ${image.description ?? image.id}` ,
              success: `Deleted Storefront Image ${image.description ?? image.id}`
            });
          }}><FontAwesomeIcon icon="x"/></span>
          <span className="text-lg text-accent hover:text-accent-focus cursor-pointer w-fit h-fit" onClick={(ev) => {
            ev.stopPropagation();
            setEditingImage(image);
          }}><FontAwesomeIcon icon="pencil"/></span>
        </div>) : undefined}
        {imageCount > 1 ? (
          <div className="absolute flex justify-between transform -translate-y-1/2 left-5 right-5 top-1/2">
            <a href={`#slide-${previousSlide}`} className="btn btn-circle">❮</a> 
            <a href={`#slide-${nextSlide}`} className="btn btn-circle">❯</a>
          </div>
        ) : undefined}
      </div>
    })}
  </div>
  <div className="flex justify-center w-full py-2 gap-2">
    {images.map((image, index) => (<a href={`#slide-${index}`} className="btn btn-xs">{index + 1}</a>))}
    {editing ? (<a href={`#add-slide`} className="btn btn-xs btn-success" onClick={(ev) => {
      ev.stopPropagation();
      ev.preventDefault();

      setEditingImage("create");
    }}>+</a>) : undefined}
  </div>
  </>
}

function StorefrontMarker({storefront, category, map, isEditMode, allCategories, onDeleteClick, onStorefrontEdited}: StorefrontMarkerProps) {
  const [isEditingStorefront, setIsEditingStorefront] = useState(false);

  const [storefrontImages, setStorefrontImages] = useState<StorefrontImageRow[]>();

  const supabase = useSupabaseClient<Database>();

  const onMarkerClick = useCallback((ev: L.LeafletMouseEvent) => {
    if(map !== null) {
      map.setView(ev.latlng, map.getZoom(), {
        animate: true,
        duration: 2
      });
    }
  }, []);

  const retrieveImages = useCallback(async () => {
    const {data, error} = await supabase.from('storefront_images').select('*').eq('storefront_id', storefront.id);
    if(error !== null) {
      console.error(error);
      if(error.code === "42501") {
        throw "Insufficient permissions."
      }

      throw "An unknown error occured";
    }
    console.log(data);
    setStorefrontImages(data);
  }, [storefront]);

  const onPopupOpen = useCallback(() => {
    // TODO: Caching?
    retrieveImages().catch((reason) => {
      setStorefrontImages(undefined);
      toast.error(`Failed to load images for ${storefront.title ?? storefront.id}: ${reason}`)
    });
  }, []);

  const onPopupClose = useCallback(() => {
    console.log("close")
    setIsEditingStorefront(false);
  }, []);

  const markerRef = useRef<L.Marker>(null);
  const markerReferenceCallback = useCallback((ref: L.Marker | null) => {
    // Make sure we remove the listener from a previous reference.
    if(markerRef.current !== null) {
      markerRef.current.removeEventListener("click", onMarkerClick);
      markerRef.current.removeEventListener("popupclose", onPopupClose);
      markerRef.current.removeEventListener("popupopen", onPopupOpen);
    }

    if(ref !== null) {
      ref.on("click", onMarkerClick);
      ref.on("popupopen", onPopupOpen);
      ref.on("popupclose", onPopupClose);
    }

    (markerRef as Writable<typeof markerRef>).current = ref;
  }, []);

  const divIconElementRef = useRef(document.createElement('div'));

  useEffect(() => {
    divIconElementRef.current.style.translate = "";
    divIconElementRef.current.className = `w-fit h-fit -translate-x-1/2 -translate-y-full ${storefront.published ? '' : 'opacity-50 hover:opacity-100'}`
  }, [storefront.published]);

  return (
    <Marker ref={markerReferenceCallback} key={storefront.id} icon={L.divIcon({
      html: divIconElementRef.current,
      iconSize: [0,0],
    })} position={assertJsonLocation(storefront.location)}>
      {ReactDOM.createPortal(<>
        <img src={location_pin} className={'h-10'}/>
        <FontAwesomeIcon 
          size="lg"
          className="fixed top-0 left-1/2 -translate-x-1/2 translate-y-1/2"
          icon={parse.icon(category.icon ?? 'store')} />
      </>, divIconElementRef.current)}
      <Popup minWidth={200}>
        {isEditingStorefront ? (
          <StorefrontEditForm 
            category={category} 
            storefront={storefront} 
            disableEditMode={() => setIsEditingStorefront(false)} 
            categories={allCategories}
            onSubmit={async (changed) => {
              // TODO: Add RLS to make sure only certain things can be updated.
              const {error} = await supabase.from('storefronts').update(changed).eq('id', storefront.id);

              if(error !== null) {
                console.error(error);
                if(error.code === "42501") {
                  throw "Insufficient permissions."
                }
    
                throw "An unknown error occured";
              }

              onStorefrontEdited(storefront.id, changed);
              setIsEditingStorefront(false);
            }}/>
        ) : (
          <>
            <h1 className='text-3xl font-semibold '>{storefront.title}</h1>
            <h2 className='text-xl font-light'>{category.title}</h2>
            {storefront.published ? undefined : (<h3 className={'text-red-600'}>Unpublished</h3>)}
            {storefront.description !== null ? (<p className='text-sm'>{storefront.description}</p>) : undefined}
            {(storefrontImages !== undefined && storefrontImages.length > 0) || isEditMode ? (<StorefrontImageCarousel images={storefrontImages ?? []} editing={isEditMode} storefront={storefront} refreshImages={retrieveImages}/>) : undefined}
            {isEditMode ? (<div className="flex gap-2 flex-row-reverse">
              <button className="btn btn-xs btn-primary" onClick={(ev) => {
                ev.stopPropagation();
                setIsEditingStorefront(true);
              }}>Edit</button>
              <button className="btn btn-xs btn-error" onClick={(ev) => {
                ev.stopPropagation();
                onDeleteClick();
              }}>Delete</button>
              <button className="btn btn-xs btn-info" onClick={(ev) => {
                ev.stopPropagation();
                
                const publish = async () => {
                  const updateQuery = {
                    published: !storefront.published
                  }

                  const {error, data} = await supabase.from('storefronts').update(updateQuery).eq('id', storefront.id).select('published');
  
                  if(error !== null) {
                    console.error(error);
                    if(error.code === "42501") {
                      throw "Insufficient permissions."
                    }
        
                    throw "An unknown error occured";
                  }

                  if(data.length < 1 || (data[0].published !== updateQuery.published)) {
                    throw "Could not publish storefront, may not have permissions.";
                  }

                  onStorefrontEdited(storefront.id, updateQuery);
                };

                toast.promise(publish(), {
                  loading: `${storefront.published ? "Unp" : "P"}ublishing ${storefront.title ?? storefront.id}...`,
                  success: `${storefront.published ? "Unp" : "P"}ublished  ${storefront.title ?? storefront.id}`,
                  error: (x) => String(x)
                })
              }}>{storefront.published ? "Unpublish" : "Publish"}</button>
            </div>) : undefined}
          </>
        )}
        
      </Popup>
    </Marker>
  );
}

interface MapProperties {
  storefronts: Array<StorefrontRow>;
  categories: Array<StorefrontCategoryRow>;
  isEditMode: boolean;

  resetView: boolean;

  editModeLocation?: L.LatLng;
  setEditModeLocation: React.Dispatch<React.SetStateAction<L.LatLng | undefined>>;

  onEditStorefrontClick: (id: string, changed: Partial<StorefrontRow>) => void;
  onDeleteStorefrontClick: (id: string, title: string) => void;
}

export default function Map({resetView, storefronts, categories, isEditMode, editModeLocation, setEditModeLocation, onEditStorefrontClick, onDeleteStorefrontClick: onDeleteClick}: MapProperties) {
  const mapReference = useRef<L.Map>(null);

  const onMapClick_EditMode = useCallback((ev: L.LeafletMouseEvent) => {
    setEditModeLocation(ev.latlng);
  }, []);

  useEffect(() => {
    // Make sure we have a reference to map.
    if(mapReference.current === null) return;

    const map = mapReference.current;
    if(resetView) {
      map.setView([0, 0], 2, {
        animate: true,
        duration: 2000,
      });
    }
  }, [resetView]);

  useEffect(() => {
    // Make sure we have a reference to map.
    if(mapReference.current === null) return;

    const map = mapReference.current;

    if(isEditMode) {
      map.on("click", onMapClick_EditMode);
    } else {
      map.removeEventListener("click", onMapClick_EditMode);

      setEditModeLocation(undefined);
    }
  }, [isEditMode]);

  return (
    <MapContainer ref={mapReference} id='map' center={[0,0]} minZoom={1} maxZoom={7} zoom={2} zoomControl={false} className='h-screen w-screen absolute top-0 left-0 z-0' doubleClickZoom={false}>
      <TileLayer
        attribution='&copy; San Andreas Radar Map by <a href="https://aothsa.com/gtav-fivem-map-mods/">DieLikeKane</a>, Adopted from <a href="https://github.com/skyrossm/np-gangmap">np-gangmap</a> | Location icons created by IconMarketPK - Flaticon, slightly modified'
        url={`${import.meta.env.BASE_URL}tiles/atlas/{z}/{x}_{y}.png`}
        noWrap={true}
      />
      <LayersControl position='topleft'>
        {categories.map((category) => (
          <LayersControl.Overlay key={category.id} name={category.title ?? category.id} checked={true}>
            <LayerGroup>
              {storefronts.filter((storefront) => storefront.published || isEditMode).filter((storefront) => storefront.category === category.id || (storefront.category === null && category.is_general)).map((storefront) => (
                <StorefrontMarker 
                  isEditMode={isEditMode} 
                  category={category} 
                  allCategories={categories} 
                  storefront={storefront} 
                  map={mapReference.current} 
                  onDeleteClick={() => onDeleteClick(storefront.id, storefront.title ?? storefront.id)}
                  onStorefrontEdited={(id, changed) => onEditStorefrontClick(id, changed)}/>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>
        ))}
      </LayersControl>
      {isEditMode && editModeLocation !== undefined ? (
        <Marker position={editModeLocation} key={"EditModePlaceLocation"}/>
      ) : undefined}
    </MapContainer>
  );
}
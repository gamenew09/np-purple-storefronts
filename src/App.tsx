import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import { Database, Json } from './database.types';
import { LayerGroup, LayersControl, MapContainer, Marker, Popup, TileLayer, VideoOverlay } from 'react-leaflet';

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Session, User, useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

import Map from "./Map";
import { PostgrestError, UserIdentity } from '@supabase/supabase-js';
import { Combobox, Transition } from '@headlessui/react';
import React from 'react';
import Button from './components/Button';
import DialogStyled from './components/Dialog';
import { useForm } from 'react-hook-form';
import { FieldValues } from 'react-hook-form/dist/types';
import StyledCombobox, { ComboboxValue } from './components/Combobox';
import { PickTable, StorefrontCategoryRow, StorefrontRow } from './dbtypes';
import { createPortal } from 'react-dom';
import InputGroup from './components/InputGroup';
import ToastContainer from './ToastContainer';
import toast from 'react-hot-toast';
import { getAllCategories, addNonexistingCategories, addNonexistingLocations, buildSeedQueries } from './locationsMerging';

type DiscordIdentity = UserIdentity & {
  provider: "discord";
  identity_data: {
    avatar_url: string,
    email: string,
    email_verified: boolean,
    full_name: string,
    iss: string,
    name: string,
    picture: string,
    provider_id: string,
    sub: string
  }
};

function getDiscordIdentity(user: User): DiscordIdentity | null {
  const discordIdentity: DiscordIdentity = (user.identities ?? []).filter((identity) => identity.provider === "discord")[0] as DiscordIdentity

  if(discordIdentity === undefined) return null;

  return discordIdentity;
}

function LoggedInTopbar({session}: {session: Session}) {
  const supabase = useSupabaseClient<Database>();

  const handleClick = useCallback<React.MouseEventHandler>((ev) => {
    supabase.auth.signOut();
  }, [supabase]);

  const user = session.user;
  const discord = getDiscordIdentity(user);

  const picture = discord?.identity_data.picture;;
  const displayFirstInitial = discord?.identity_data.full_name.at(0);

  return <div className="dropdown dropdown-end overlay-over-map">
    {picture !== undefined ? (
      <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
        <div className="w-10 rounded-full">
          <img src={picture} />
        </div>
      </label>
    ) : (
      <label className="avatar placeholder">
        <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
          <span className="text-lg">{displayFirstInitial ?? user.email?.at(0) ?? user.id.at(0)}</span>
        </div>
      </label> 
    )}
  
  <ul tabIndex={0} className="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52">
    <li><a onClick={handleClick}>Logout</a></li>
  </ul>
</div>
}

function LoggedOutTopbar() {
  const supabase = useSupabaseClient<Database>();

  const handleClick = useCallback<React.MouseEventHandler>((ev) => {
    supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify email',
        redirectTo: `${import.meta.env.VITE_DOMAIN_BASE}${import.meta.env.BASE_URL}`,
      },
    })
  }, [supabase]); 
  return <button className='btn btn-ghost' onClick={handleClick}>Login</button>
}

function useAdminState() {
  const [isAdmin, setIsAdmin] = useState(false);

  const supabase = useSupabaseClient<Database>();
  const session = useSession();

  useEffect(() => {
    const handleCheck = async () => {
      if(session === null) {
        setIsAdmin(false);
      } else {
        const {data, error} = await supabase.from('permissions').select('*');

        if(error === null) {
          setIsAdmin(data.length > 0);
        } else {
          console.error(error);
        }
      }
    };
    handleCheck();
  }, [session]);

  return isAdmin;
}

function Topbar({isEditMode, toggleEditMode, resetMapView}: {isEditMode: boolean; toggleEditMode: () => void; resetMapView: () => void}) {
  const session = useSession();

  const isAdmin = useAdminState();

 return <div className='navbar bg-primary text-primary-content overlay-over-map absolute'>
  <div className="navbar-start">
    {session != null && isAdmin ? (
      <>
      <button className={`btn btn-ghost ${isEditMode ? 'btn-active' : ''}`} onClick={() => {
        toggleEditMode();
      }}>Toggle Edit Mode</button>
    </>
    ) : undefined}
  </div>
  <div className="navbar-center">
    <a className="btn btn-ghost normal-case text-xl" onClick={() => resetMapView()}>NoPixel Purple Storefronts</a>
  </div>
  <div className="navbar-end">
    {session != null ? (<LoggedInTopbar session={session}/>) : (<LoggedOutTopbar/>) }
  </div>
 </div>
}
function EditModeBar({hasLocationBeenSet, onCreateButtonClicked, onClearMarkerClicked}: {hasLocationBeenSet: boolean, onCreateButtonClicked: () => void, onClearMarkerClicked: () => void}) {
  return <div className="btm-nav overlay-over-map justify-start gap-1">
  <span className='basis-1/2 flex-grow text-lg font-bold'>Select a location to create a new storefront.</span>
  <button className='btn basis-1/6' disabled={!hasLocationBeenSet} onClick={onClearMarkerClicked}>Clear Marker</button>
  <button className='btn btn-primary basis-1/6' disabled={!hasLocationBeenSet} onClick={onCreateButtonClicked}>Create</button>
</div>
}

function ErrorAlert({error}: {error?: PostgrestError}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(error !== undefined);
  }, [error]);

  return (
    <DialogStyled open={open} title="Error Occurred" description='An error has occurred while trying to load the storefront listing.' onClose={() => setOpen(false)}>
      <code>
        {error?.message ?? "unknown"}
      </code>

      <div className='block pt-3'>
        <Button onClick={() => setOpen(false)}>OK</Button>
      </div>
    </DialogStyled>
  );
}

interface StorefrontCreationData {
  title: string;
  description: string;
  categoryId: string;
}

interface CreateStorefrontDialogProps {
  open: boolean; 
  onSubmit: (data: StorefrontCreationData) => Promise<void>;
  categories?: Array<StorefrontCategoryRow>;
  onClose: () => void;
}

function CreateStorefrontDialog({onSubmit, open, categories, onClose}: CreateStorefrontDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>();

  const [error, setError] = useState<string>();

  useEffect(() => {
    if(open) {
      setError(undefined);
    }
  }, [open]);

  const titleInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);

  const onSubmitInternal = useCallback(async () => {
    // TODO: DO BETTER VALIDATION OF INPUTS

    if(titleInput.current === null || descriptionInput.current === null) return;

    try {
      const title = titleInput.current.value;
      const desc = descriptionInput.current.value;

      if(/^$/.exec(title)) {
        throw "Title must not be empty.";
      }
      if(/^$/.exec(desc)) {
        throw "Description must not be empty.";
      }
      if(selectedCategory === undefined) {
        throw "You must select a category.";
      }

      await onSubmit({
        categoryId: selectedCategory,
        title: title,
        description: desc,
      });
      setError(undefined);
    } catch(reason) {
      setError(String(reason));
      console.error(reason);
    }
  }, [selectedCategory]);

  return <DialogStyled open={open} onClose={onClose} title='Create New Storefront' description='Enter in the following form to create a new storefront.'>
    {
      error !== undefined ? (<div  key={4} className="alert alert-error shadow-lg">
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error! {error}</span>
      </div>
    </div>) : undefined
    }
    {/*
    Title (text)
    Category (select)
    Description (textarea)
    */}
    <InputGroup label='Title'>
      <input ref={titleInput} type="text" placeholder='Your new cool storefront' className='input input-bordered' />
    </InputGroup>
    <InputGroup label='Category'>
      <select defaultValue={""} onChange={(ev) => setSelectedCategory(ev.target.value === "" ? undefined : ev.target.value)} className='select select-bordered'>
        <option disabled value="">Select Category</option>
        {categories?.map((category) => (<option value={category.id}>{category.title}</option>))}
      </select>
    </InputGroup>
    <InputGroup label='Description'>
      <textarea ref={descriptionInput} placeholder='Cool Storefront is a storefront that sells cool items for the citizens of San Andreas.' className='textarea textarea-bordered'></textarea>
    </InputGroup>
    <div className='modal-action'>
      <button key={0} className='btn' onClick={onClose}>Cancel</button>
      <button key={1} className='btn btn-primary' onClick={onSubmitInternal}>Submit</button>
    </div>
  </DialogStyled>
}

function App() {
  const session = useSession();

  const [resetView, setResetView] = useState(false);

  const [storefronts, setStorefronts] = useState<Array<Database["public"]["Tables"]["storefronts"]["Row"]>>();
  const [categories, setCategories] = useState<Array<PickTable<"public", "storefront_categories">["Row"]>>();

  const [editModeLocation, setEditModeLocation] = useState<L.LatLng>();

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<PostgrestError>();

  const [isEditMode, setEditMode] = useState(false);

  const [storefrontCreatorDialogOpen, setStorefrontCreatorDialogOpen] = useState(false);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  useEffect(() => {
    if(session === null) {
      // If edit mode is on, then disable it now.
      if(isEditMode)
        setEditMode(false);
    }
  }, [session]);

  const supabase = useSupabaseClient<Database>();

  const refreshMap = useCallback(() => {
    const fetchStorefronts = async () => {
      const {data: storefrontsRetrieved, error} = await supabase.from("storefronts").select("*").order('id');

      if(error) {
        throw error;
      }
      else setStorefronts(storefrontsRetrieved);
    };

    const handleCategories = async () => {
      const {data: categories, error} = await supabase.from('storefront_categories').select('*');

      if(error) {
        throw error;
      }
      else setCategories(categories);
    };

    setIsLoading(true);
    fetchStorefronts().then(handleCategories).catch((reason) => {
      if(typeof reason === "object" && typeof reason.message === "string") {
        setError(reason);
      }
    }).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refreshMap();
  }, []);

  useEffect(() => {
    // Instantly turn off reset view.
    if(resetView)
      setResetView(false);
  }, [resetView]);

  return (
    <>
      <Topbar isEditMode={isEditMode} toggleEditMode={toggleEditMode} resetMapView={() => setResetView(true)}/>
      {isEditMode ? <EditModeBar hasLocationBeenSet={editModeLocation !== undefined} onCreateButtonClicked={() => setStorefrontCreatorDialogOpen(true)} onClearMarkerClicked={() => {setEditModeLocation(undefined)}}/> : undefined }
      <ErrorAlert error={error}/>
      <ToastContainer/>
      <CreateStorefrontDialog open={storefrontCreatorDialogOpen} onClose={() => setStorefrontCreatorDialogOpen(false)} onSubmit={async (data) => {
        if(editModeLocation === undefined) throw new Error('Location has not been set.');
        
        const {error} = await supabase.from('storefronts').insert({
          location: {lat: editModeLocation.lat, lng: editModeLocation.lng},
          category: data.categoryId,
          title: data.title,
          description: data.description,
        });
        
        if(error !== null) {
          console.error(error);

          if(error.code === "42501") {
            throw "Insufficient permissions."
          }

          throw "An unknown error occured";
        }

        setEditModeLocation(undefined);
        setStorefrontCreatorDialogOpen(false);
        toast.success(`Created storefront ${data.title} successfully.`, {
          duration: 1000*5
        });
        refreshMap();
      }} categories={categories} />
      {isLoading ? (
        
        <div className='fixed modal inset-0 backdrop-blur-sm'>
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' role="status">
              <svg aria-hidden="true" className="w-8 h-8 mr-2 text-gray-200 animate-spin dark:text-gray-600 fill-purple-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                  <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
              </svg>
              <span className="sr-only">Loading...</span>
          </div>
        </div>

      ) : undefined}
      <Map resetView={resetView} storefronts={storefronts ?? []} categories={categories ?? []} isEditMode={isEditMode} editModeLocation={editModeLocation} setEditModeLocation={setEditModeLocation} onEditStorefrontClick={async (id: string, changed) => {
        let previousStorefrontData: StorefrontRow | undefined = undefined;
        
        setStorefronts((storefronts) => {
          if(storefronts === undefined) return undefined;

          return storefronts.map((storefront) => {
            if(storefront.id !== id) return storefront;
            previousStorefrontData = Object.assign({}, storefront); // Just in case we need to revert.
            return Object.assign(storefront, changed);
          });
        });

        // Verify that the row was changed in the database.
        const {data, error} = await supabase.from('storefronts').select('*').eq('id', id);
        try {
          console.log(data);

          if(error !== null) {
            if(error.code === "42501") {
              throw "Insufficient permissions."
            }
  
            throw "An unknown error occured";
          }

          const hasNotChangedOne = Object.keys(changed).reduce((prev, column) => {
            if(prev === true) return prev;

            return changed[column as keyof typeof changed] !== data[0][column as keyof StorefrontRow];
          }, false);

          console.log(hasNotChangedOne);

          if(hasNotChangedOne) {
            throw "Couldn't edit storefront, may not have permissions."
          }
        } catch (err) {
          toast.error(`Unable to edit: ${err}`);

          if(previousStorefrontData === undefined) {
            console.error("Failed to revert data back to previous state.")
            return;
          }
          // Revert the change we did just a second ago.
          setStorefronts((storefronts) => {
            if(storefronts === undefined) return undefined;
  
            return storefronts.map((storefront) => {
              if(storefront.id !== id) return storefront;
              return previousStorefrontData ?? storefront;
            });
          });
        }
      }} onDeleteStorefrontClick={(storefrontId, title) => {

        const deleteStorefront = async () => {
          let {error} = await supabase.from('storefronts').delete().eq('id', storefrontId);

          if(error === null) {
            let {error, data} = await supabase.from('storefronts').select('id').eq('id', storefrontId);

            if(error === null && (data?.length ?? 0) > 0) {
              throw "Could not delete storefront, may not be allowed to.";
            }
          }

          if(error !== null) {
            if(error.code === "42501") {
              throw "Insufficient permissions."
            }

            throw "An unknown error occured";
          }
          refreshMap();
        };
        
        toast.promise(deleteStorefront(), {
          loading: `Deleting storefront ${title}`,
          error: (error) => `${error}`,
          success: `Deleted storefront ${title}` 
        });
      }}/>
    </>
  )
}

export default App

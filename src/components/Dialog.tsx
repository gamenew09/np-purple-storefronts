import { Transition, Dialog } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import Button from "./Button";

export function DialogControls({children}: {children?: React.ReactNode}) {
  return <>
  </>
}

interface DialogProps {
    open: boolean;

    title: string;
    description: string | React.ReactNode;

    children?: React.ReactNode | React.ReactNode[];

    descriptionPosition?: "top" | "bottom";

    showCloseCross?: boolean;

    panelClassName?: string;
    titleClassName?: string;

    onClose: () => void;
}
export default function DialogStyled({descriptionPosition, titleClassName, panelClassName, open, title, description, children, onClose, showCloseCross}: DialogProps) {
    const descPos = descriptionPosition ?? "top";
    return (
      <Dialog as="div" className={`modal ${open? "modal-open" : ""}`} open={open} onClose={onClose}>
        <Dialog.Panel className={`modal-box ${panelClassName}`}>
          {showCloseCross ? (<label onClick={onClose} className="btn btn-sm btn-circle absolute right-2 top-2">✕</label>) : undefined}
          <Dialog.Title className={titleClassName ?? `font-bold text-lg`}>{title}</Dialog.Title>
          {descPos === "top" ? <Dialog.Description as="p" className={'py-4'}>
            {description}
          </Dialog.Description> : undefined}

          {children}

          {descPos === "bottom" ? <Dialog.Description as="p" className={'py-4'}>
            {description}
          </Dialog.Description> : undefined}
        </Dialog.Panel>
      </Dialog>
    );
}
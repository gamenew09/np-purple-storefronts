import { Transition } from "@headlessui/react";
import { useEffect, useState } from "react"
import toast, { Toast, Toaster, ToastIcon, useToaster, resolveValue } from "react-hot-toast";

interface ToastContainerProps {

}

function parseToastType(toastType: Toast["type"]): HTMLDivElement["className"] {
    switch(toastType) {
        case "success":
            return "toast-success";
        case "error":
            return "toast-error";
        default:
            return "";
    }
}

export default function ToastContainer(props: ToastContainerProps) {
    return <Toaster containerClassName={`toast toast-bottom toast-end overlay-on-map mr-3 mt-14`} position="top-right">
        {(t) => (
            <Transition
                as='div'
                appear
                show={t.visible}
                className={`alert ${parseToastType(t.type)} w-fit h-fit`}
                enter="transition-all duration-150"
                enterFrom="opacity-0 scale-50"
                enterTo="opacity-100 scale-100"
                leave="transition-all duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-75"
            >
                <ToastIcon toast={t} />
                <span className="px-2">{resolveValue(t.message, t)}</span>
            </Transition>
        )}
    </Toaster>;
}
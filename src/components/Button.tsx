type HTMLButtonProps = JSX.IntrinsicElements["button"];
interface ButtonProps {
    onClick?: HTMLButtonProps["onClick"];
    children?: HTMLButtonProps["children"];
    disabled?: HTMLButtonProps["disabled"];
    style?: keyof ButtonStyles;
}

const ButtonStyles = {
    default: {
        normal: "border border-indigo-500 bg-indigo-500 text-white rounded-md px-4 py-2 m-2 transition duration-500 ease select-none hover:bg-indigo-600 focus:outline-none focus:shadow-outline",
        disabled: "border border-indigo-500 bg-indigo-900 text-white rounded-md px-4 py-2 m-2 cursor-not-allowed"
    }
};
type ButtonStyles = typeof ButtonStyles;

export default function Button({style, onClick, children, disabled}: ButtonProps) {
    return (<button disabled={disabled} aria-disabled={disabled} className={ButtonStyles[style ?? "default"][disabled ? "disabled" : "normal"]} onClick={onClick}>
        {children}
    </button>);
}
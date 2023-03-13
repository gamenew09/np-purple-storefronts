interface InputGroupProps {
    children: React.ReactNode[] | React.ReactNode;
    label?: string;
    /**
     * If there are multiple children, are we vertically placing them?
     */
    vertical?: boolean;
    size?: 'lg' | 'md' | 'sm' | 'xs';
}

export default function InputGroup({children, label, vertical, size}: InputGroupProps) {
    const multipleChildren = Array.isArray(children) && children.length > 1;
    
    return <div className="form-control">
    {label ? (<label className="label">
      <span className="label-text">{label}</span>
    </label>) : undefined}
    {(multipleChildren || size !== undefined) ? (<label className={`input-group ${size ? `input-group-${size}` : ""} ${vertical ? "input-group-vertical" : ""}`}>
        {children}
    </label>) : (children)}
  </div>
}
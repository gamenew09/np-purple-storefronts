import { Combobox } from "@headlessui/react";
import { useState } from "react";

export type ComboboxValue = {id: string; display: string;}

interface StyledComboboxProps {
    value: ComboboxValue;
    data: ComboboxValue[];
    onChange: (newValue: ComboboxValue) => void;
    queryCheck?: typeof defaultQueryCheck;
    name: string;
}

const defaultQueryCheck = (query: string, data: ComboboxValue[]): ComboboxValue[] => (
    query === '' ? data : data.filter((d) => d.display.toLowerCase().includes(query.toLowerCase()))
)

export default function StyledCombobox({queryCheck, value, onChange, data, name}: StyledComboboxProps) {
    const [query, setQuery] = useState<string>('');

    const filteredDatapoints = (queryCheck ?? defaultQueryCheck)(query, data);

    console.log(value);

    return <Combobox value={value} onChange={onChange}>
        <Combobox.Input 
            name={name}
            id={name}
            onChange={(ev) => setQuery(ev.target.value)}
            displayValue={(item: ComboboxValue) => item.display}
            className={`text-black`} />
        <Combobox.Options className={`absolute bg-black min-w-24 p-1`}>
            {filteredDatapoints.map((data) => (
                <Combobox.Option key={data.id} value={data} className={`hover:bg-gray-600 cursor-default`}>
                    {data.display}
                </Combobox.Option>
            ))}
        </Combobox.Options>
    </Combobox>
}
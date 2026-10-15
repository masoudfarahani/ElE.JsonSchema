import * as vld from './validators';

export enum ElemType { object, array, number, string, boolean, date }

export abstract class Elem {
    constructor(public elemName: string) {}
    abstract elemType: ElemType;
    validators: vld.Validator[] = [];
    properties: Elem[] = [];

    AddValidator(validator: vld.Validator): void {
        if (!validator.AvailableFor().includes(this.elemType)) {
            throw new Error(`Validator is not applicable to ${ElemType[this.elemType]}`);
        }
        this.validators.push(validator);
    }

    AddProperties(_elem: Elem): void {
        throw new Error(`${ElemType[this.elemType]} cannot have properties`);
    }

    ToSchema(): Record<string, unknown> {
        const schema: Record<string, unknown> = { type: this.elemType === ElemType.date ? 'string' : ElemType[this.elemType] };
        if (this.elemType === ElemType.date) schema.format = 'date';
        for (const validator of this.validators) {
            if (!(validator instanceof vld.RequiredValidator)) Object.assign(schema, JSON.parse(`{${validator.ToString()}}`));
        }
        if (this.elemType === ElemType.object) {
            schema.properties = Object.fromEntries(this.properties.map(child => [child.elemName, child.ToSchema()]));
            const required = this.properties.filter(child => child.validators.some(v => v instanceof vld.RequiredValidator)).map(child => child.elemName);
            if (required.length) schema.required = required;
        }
        if (this.elemType === ElemType.array && this.properties[0]) schema.items = this.properties[0].ToSchema();
        return schema;
    }

    ToString(): string { return JSON.stringify(this.ToSchema(), null, 2); }
}

export class ObjectElem extends Elem {
    elemType = ElemType.object;
    AddProperties(elem: Elem): void { this.properties.push(elem); }
}
export class ArrayElem extends Elem {
    elemType = ElemType.array;
    AddProperties(elem: Elem): void { this.properties = [elem]; }
}
export class NumberElem extends Elem { elemType = ElemType.number; }
export class StringElem extends Elem { elemType = ElemType.string; }
export class BooleanElem extends Elem { elemType = ElemType.boolean; }
export class DateElem extends Elem { elemType = ElemType.date; }

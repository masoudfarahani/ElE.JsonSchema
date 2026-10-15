import { ElemType } from "./elem";

class ValidatorRegistry {
    private static validatorsByType: Map<ElemType, Validator[]> | null = null;

    static GetValidatorsByElemType(): Map<ElemType, Validator[]> {
        if (this.validatorsByType === null) {
            const allValidators: Validator[] = [
                new RequiredValidator(),
                new MinValValidator(1),
                new MaxValValidator(100),
                new MinLengthValidator(1),
                new MaxLengthValidator(100),
                new MinItemsValidator(1),
                new MaxItemsValidator(100),
                new UniqueItemsValidator(),
                new MultipleOfValidator(1),
                new NumberEnum([]),
                new StringEnum([]),
                new FormatValidator(StringFormats.email),
                new RegexValidator(""),
                new AdditionalPropertiesValidator(false)
            ];

            const result = new Map<ElemType, Validator[]>();

            for (const type of Object.values(ElemType).filter(
                (value): value is ElemType => typeof value === "number"
            )) {
                result.set(type, []);
            }

            
            for (const validator of allValidators) {
                for (const type of validator.AvailableFor()) {
                    result.get(type)?.push(validator);
                }
            }

            this.validatorsByType = result;
        }

        return this.validatorsByType;
    }
}


abstract class Validator {

    name !: string;
    abstract AvailableFor(): Array<ElemType>;
    abstract ToString(): string;
}


class RequiredValidator extends Validator {
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.object,
            ElemType.array,
            ElemType.boolean,
            ElemType.date,
            ElemType.number,
            ElemType.string,
        ]
    }
    ToString(): string {
        return "";
    }
}

class MinValValidator extends Validator {

    constructor(minval: number) {
        super();
        this.minVal = minval;
    }
    minVal: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.number
        ]
    }
    ToString(): string {
        return `"minimum" : ${this.minVal}`;
    }
}


class MaxValValidator extends Validator {

    constructor(maxval: number) {
        super();
        this.maxVal = maxval;
    }
    maxVal: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.number
        ]
    }
    ToString(): string {
        return `"maximum" : ${this.maxVal}`;
    }
}


class MinLengthValidator extends Validator {

    constructor(minlen: number) {
        super();
        this.minLen = minlen;
    }
    minLen: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.string
        ]
    }
    ToString(): string {
        return `"minLength" : ${this.minLen}`;
    }
}


class MaxLengthValidator extends Validator {

    constructor(maxlen: number) {
        super();
        this.maxLen = maxlen;
    }
    maxLen: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.string
        ]
    }
    ToString(): string {
        return `"maxLength" : ${this.maxLen}`;
    }
}


class MinItemsValidator extends Validator {
    constructor(minitems: number) {
        super();
        this.minItems = minitems;
    }
    minItems: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.array
        ]
    }
    ToString(): string {
        return `"minItems" : ${this.minItems}`;
    }

}


class MaxItemsValidator extends Validator {
    constructor(maxitems: number) {
        super();
        this.maxItems = maxitems;
    }
    maxItems: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.array
        ]
    }
    ToString(): string {
        return `"maxItems" : ${this.maxItems}`;
    }

}

class UniqueItemsValidator extends Validator {

    AvailableFor(): Array<ElemType> {
        return [
            ElemType.array
        ]
    }

    ToString(): string {
        return `"uniqueItems" : true`;
    }
}

class MultipleOfValidator extends Validator {
    constructor(multipleOf: number) {
        super();
        this.multipleOf = multipleOf;
    }

    multipleOf: number;
    AvailableFor(): Array<ElemType> {
        return [
            ElemType.number
        ];
    }

    ToString(): string {
        return `"multipleOf" : ${this.multipleOf}`;
    }



}

class NumberEnum extends Validator {
    enums: number[];

    constructor(enums: Array<number>) {
        super();
        this.enums = enums;
    }

    AvailableFor(): Array<ElemType> {
        return [
            ElemType.number
        ];
    }

    ToString(): string {
        return `"enum" : [${this.enums.join(",")}]`;
    }

}


class StringEnum extends Validator {
    enums: string[];

    constructor(enums: Array<string>) {
        super();
        this.enums = enums;
    }

    AvailableFor(): Array<ElemType> {
        return [
            ElemType.string
        ];
    }

    ToString(): string {
        return `"enum" : ${JSON.stringify(this.enums)}`;
    }

}



class FormatValidator extends Validator {
    format: StringFormats;
    constructor(format: StringFormats) {
        super();
        this.format = format;
    }

    AvailableFor(): Array<ElemType> {
        return [ElemType.string];
    }
    ToString(): string {
        return `"format" : "${this.format}"`;
    }
}

class RegexValidator extends Validator {
    pattern: string;

    constructor(pattern: string) {
        super();
        this.pattern = pattern;
    }

    AvailableFor(): Array<ElemType> {
        return [ElemType.string];
    }
    ToString(): string {
        return `"pattern" : ${JSON.stringify(this.pattern)}`;
    }
}


class AdditionalPropertiesValidator extends Validator {
    AvailableFor(): Array<ElemType> {
        return [ElemType.object];
    }
    ToString(): string {
        return `"additionalProperties" : ${this.additionalProperties}`;
    }
    constructor(additionalProperties: boolean) {
        super();
        this.additionalProperties = additionalProperties;
    }
    additionalProperties: boolean;
}











enum StringFormats {
    datetime = "date-time",
    date = "date",
    time = "time",
    email = "email",
    uuid = "uuid",
    uri = "uri",
    hostname = "hostname",
    ipv4 = "ipv4",
    ipv6 = "ipv6"
}




export { Validator, AdditionalPropertiesValidator, StringFormats, RegexValidator, FormatValidator, StringEnum, NumberEnum, MultipleOfValidator as MultipleOfValidator, RequiredValidator, MinValValidator, MaxValValidator, MinLengthValidator, MaxLengthValidator, MinItemsValidator, MaxItemsValidator, UniqueItemsValidator, ValidatorRegistry };

class NfisQuickEntryObjectTypeForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "objectTypeForm";
    }

    getSubForms() {
        return [];
    }

    getDefaultData() {
        return {
            objectType: this.optionsMap.nld_object_type?.[0]?.value || null,
        };
    }

    getFields() {
        return [
            {
                type: NfisQuickEntrySearchableSelect,
                name: "objectType",
                form: { label: "Objekttyp" },
                options: () => {
                    return this.optionsMap['nld_object_type']
                },
            },
        ];
    }
}

class NfisQuickEntryNewForm extends NfisQuickEntryForm {

    constructor({ poolIds, optionsMap, ...rest } = {}) {
        super(rest);
        this.poolIds = poolIds;
        this.optionsMap = optionsMap;
    }

    getName() {
        return "startForm";
    }

    getDefaultData() {
        return {
            pool: null,
            vocab: 'no_vocab',
            gemarkung: null,
            politicalAffiliation: null,
            objectType: null,
            objectCategory: null,
        };
    }

    getFields() {
        const data = this.getData();

        const isGemarkungDisabled = (vocab) => {
            return vocab === 'no_vocab' || !['niedersachsen', 'bremen'].includes(vocab)
        }

        return [
            {
                type: PoolSelector,
                name: "pool",
                form: { label: "Pool" },
                pool_ids: this.poolIds,
                onDataChanged: (changedData) => {
                    console.log({ changedData, formData: this.getData() });
                }
            },
            {
                type: CUI.Select,
                name: "vocab",
                form: { label: "Vokabular" },
                disabled: (context) => {
                    return this.optionsMap.vocab.length <= 1;
                },
                options: () => {
                    return this.optionsMap['vocab']
                },
                onDataChanged: (changedData, element) => {
                    console.log({ changedData, formData: this.getData() });
                    if (changedData.vocab === 'niedersachsen') {
                        data.gemarkung = this.optionsMap['nld_gemarkung_niedersachsen']?.[0]?.value || null
                        data.politicalAffiliation = this.optionsMap['areal_unit_niedersachsen']?.[0]?.value || null

                    }
                    if (changedData.vocab === 'bremen') {
                        data.gemarkung = this.optionsMap['nld_gemarkung_bremen']?.[0]?.value || null
                        data.politicalAffiliation = this.optionsMap['areal_unit_bremen']?.[0]?.value || null

                    }

                    // disabled is only evaluated once at field construction, CUI does not
                    // re-run it reactively, so we toggle the sibling field explicitly here
                    const gemarkungField = element.getOtherField('gemarkung')
                    const politicalAffiliationField = element.getOtherField('politicalAffiliation')
                    if (isGemarkungDisabled(data.vocab)) {
                        gemarkungField?.disable()
                        politicalAffiliationField?.disable()
                    } else {
                        gemarkungField?.enable()
                        politicalAffiliationField?.enable()
                    }
                }
            },
            {
                type: NfisQuickEntrySearchableSelect,
                name: "gemarkung",
                disabled: (context) => {
                    return isGemarkungDisabled(data.vocab)
                },
                form: { label: "Gemarkung" },
                options: (context) => {
                    const vocab = data.vocab;
                    if (!vocab || vocab === 'no_vocab') return this.optionsMap['no_vocab'];
                    if (vocab === 'niedersachsen') return this.optionsMap['nld_gemarkung_niedersachsen']
                    if (vocab === 'bremen') return this.optionsMap['nld_gemarkung_bremen']
                    return this.optionsMap['no_vocab']
                },
                onDataChanged: (changedData) => {
                    console.log({ changedData, formData: this.getData() });
                }
            },
            {
                type: NfisQuickEntrySearchableSelect,
                name: "politicalAffiliation",
                disabled: (context) => {
                    return isGemarkungDisabled(data.vocab)
                },
                form: { label: "Gebietseinheit" },
                options: (context) => {
                    const vocab = data.vocab;
                    if (!vocab || vocab === 'no_vocab') return this.optionsMap['no_vocab'];
                    if (vocab === 'niedersachsen') return this.optionsMap['areal_unit_niedersachsen']
                    if (vocab === 'bremen') return this.optionsMap['areal_unit_bremen']
                    return this.optionsMap['no_vocab']
                },
                onDataChanged: (changedData) => {
                    console.log({ changedData, formData: this.getData() });
                }
            },
            {
                type: NfisQuickEntrySearchableSelect,
                name: "objectType",
                form: { label: "Objekttyp" },
                options: () => {
                    return this.optionsMap['nld_object_type']
                },
            },
            {
                type: NfisQuickEntrySearchableSelect,
                name: "objectCategory",
                form: { label: "Objektkategorie" },
                options: () => {
                    return this.optionsMap['nld_object_category']
                },
            },
        ];
    }
}

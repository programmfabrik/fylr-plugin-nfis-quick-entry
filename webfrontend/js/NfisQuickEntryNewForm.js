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
                    // gemarkung/politicalAffiliation are resolved via live
                    // Dante search now, so there's no pre-loaded "first
                    // option" to default to any more - just reset them
                    data.gemarkung = null
                    data.politicalAffiliation = null

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
                type: NfisQuickEntryDanteSearchableSelect,
                name: "gemarkung",
                disabled: (context) => {
                    return isGemarkungDisabled(data.vocab)
                },
                form: { label: "Gemarkung" },
                vocab: () => {
                    // the field is disabled (never focused/searched) unless
                    // one of these two is true, so the fallback here is only
                    // ever a placeholder to satisfy the mandatory opt
                    if (data.vocab === 'bremen') return 'nld_gemarkung_bremen'
                    return 'nld_gemarkung_niedersachsen'
                },
                onDataChanged: (changedData) => {
                    console.log({ changedData, formData: this.getData() });
                }
            },
            {
                type: NfisQuickEntryDanteSearchableSelect,
                name: "politicalAffiliation",
                disabled: (context) => {
                    return isGemarkungDisabled(data.vocab)
                },
                form: { label: "Gebietseinheit" },
                vocab: () => {
                    if (data.vocab === 'bremen') return 'areal_unit_bremen'
                    return 'areal_unit_niedersachsen'
                },
                onDataChanged: (changedData) => {
                    console.log({ changedData, formData: this.getData() });
                }
            },
            {
                type: NfisQuickEntryDanteSearchableSelect,
                name: "objectType",
                form: { label: "Objekttyp" },
                vocab: 'nld_object_type',
            },
        ];
    }
}

// A Dante-backed NfisQuickEntrySearchableSelect: instead of a pre-loaded
// options array, it searches the Dante API as the user types, by
// vocabulary name. Some Dante vocabularies have thousands of members (e.g.
// nld_gemarkung_niedersachsen has ~5400) and the API gives no usable total
// count and no working offset beyond roughly the first 1000 items, so
// pre-loading "all" options up front - what the base class, and CUI.Select,
// both expect - simply isn't possible for those. Searching server-side as
// the user types is the only option.
//
// Uses the /search endpoint (not /suggest), the same one
// fylr-plugin-custom-data-type-dante/webfrontend/CustomDataTypeDante.coffee
// uses, so we can replicate its "generate label with hierarchy" option: some
// vocabularies have concepts with identical-looking prefLabels that are only
// distinguishable by where they sit in the hierarchy.
//
// Drop-in usage:
//   {
//       type: NfisQuickEntryDanteSearchableSelect,
//       name: "someField",
//       form: { label: "..." },
//       vocab: "nld_gemarkung_niedersachsen",
//       label_with_hierarchy: true, // optional, default false
//   }
class NfisQuickEntryDanteSearchableSelect extends NfisQuickEntrySearchableSelect {

    initOpts() {
        super.initOpts();
        // replaces the base class's "options" (a pre-loaded array/function)
        // with "vocab" - we fetch options ourselves, there's nothing to pass in
        this.removeOpt('options');
        this.addOpts({
            // a String, or a Function for when the vocab itself depends on
            // other form data (e.g. which of two regional vocabularies to
            // search depends on a sibling field's value)
            vocab: {
                mandatory: true,
                check: (v) => CUI.util.isString(v) || CUI.util.isFunction(v)
            },
            label_with_hierarchy: {
                default: false,
                check: Boolean
            }
        });
    }

    init() {
        super.init();
        this.__selectedOption = null;
        this.__debounceTimer = null;
        this.__abortController = null;
        // caches the last successful fetch, so closing and reopening the
        // menu without changing anything doesn't re-hit the network
        this.__lastQuery = null;
        this.__lastVocab = null;
        this.__lastResults = null;
    }

    // nothing is pre-loaded, so there is no "first option" to default to
    getDefaultValue() {
        return null;
    }

    __getVocab() {
        if (CUI.util.isFunction(this._vocab)) {
            return this._vocab.call(this, this);
        }
        return this._vocab;
    }

    // matches CustomDataTypeDante.coffee's own property list; "ancestors" is
    // only requested when actually needed, since DANTEUtil.getHierarchieLabel
    // is the only thing that reads it
    __getProperties() {
        let properties = '+hiddenLabel,notation,scopeNote,definition,identifier,example,location,depiction,startDate,endDate,startPlace,endPlace';
        if (this._label_with_hierarchy) {
            properties += ',ancestors';
        }
        return properties;
    }

    // the Dante /search endpoint already filters server-side, on more than
    // plain substrings (hidden labels, synonyms, accents, ...) - re-filtering
    // client-side on top risks hiding results it correctly matched
    __getFilteredOptions() {
        return this.getOptions();
    }

    __getMenuOpts() {
        const menuOpts = super.__getMenuOpts();
        const onClick = menuOpts.itemList.onClick;
        menuOpts.itemList.onClick = (event, btn, item, idx) => {
            // remember what we just picked, so displayValue() doesn't have
            // to re-resolve a label we already know
            this.__selectedOption = item;
            onClick(event, btn, item, idx);
        };
        return menuOpts;
    }

    // shown while __loadOptions()'s debounce + network round trip is in
    // flight - matches CustomDataTypeDante.coffee's own suggestion-loading
    // placeholder
    __getLoadingOptions() {
        return [{
            text: 'Lädt…',
            icon_left: new CUI.Icon({ class: 'fa-spinner fa-spin' }),
            disabled: true
        }];
    }

    __showOrRefilterMenu(event) {
        if (this.isDisabled()) {
            return;
        }
        if (!this.__menu) {
            this.__menu = new CUI.Menu(this.__getMenuOpts());
        }
        if (this.__menu.isShown()) {
            this.__refilterMenu(event);
        } else {
            this.__menu.show(event);
        }
    }

    // overrides the base class to show a loading placeholder immediately,
    // rather than leaving the dropdown looking empty/broken for the length
    // of the debounce delay plus the actual network request
    __openMenu(event) {
        this.__options = this.__getLoadingOptions();
        this.__showOrRefilterMenu(event);

        return this.__loadOptions(event).done(() => {
            this.__showOrRefilterMenu(event);
        });
    }

    // /search returns an array of JSKOS concepts directly (unlike /suggest's
    // parallel-array shape)
    __parseSearchResponse(json) {
        if (!Array.isArray(json)) {
            return [];
        }
        return json.map((jskos) => ({
            text: DANTEUtil.getConceptNameFromJSKOSObject(jskos, 'de', this._label_with_hierarchy),
            value: jskos.uri
        }));
    }

    // debounced + abortable: __loadOptions() gets called on every keystroke
    // (via onDataChanged -> __openMenu), and without this a fast typist would
    // pile up requests, with a slow/stale one free to overwrite a newer result
    __loadOptions(event) {
        if (this.__debounceTimer) {
            clearTimeout(this.__debounceTimer);
        }
        if (this.__abortController) {
            this.__abortController.abort();
        }

        const query = this.__filterText.trim();
        const vocab = this.__getVocab();

        // closing and reopening the menu (or re-focusing after a blur)
        // without typing anything new re-runs __openMenu()/__loadOptions(),
        // but if neither the query nor the (possibly data-dependent) vocab
        // actually changed, the last fetch's results are still correct
        if (this.__lastResults && this.__lastQuery === query && this.__lastVocab === vocab) {
            this.__options = this.__lastResults;
            this.__optionsPromise = CUI.resolvedPromise(this.__options);
            return this.__optionsPromise;
        }

        const deferred = new CUI.Deferred();
        this.__optionsPromise = deferred.promise();

        this.__debounceTimer = setTimeout(() => {
            const controller = new AbortController();
            this.__abortController = controller;

            const encodedVocab = encodeURIComponent(vocab);
            const properties = encodeURIComponent(this.__getProperties());
            const url = `https://api.dante.gbv.de/search?query=${encodeURIComponent(query)}&properties=${properties}&voc=${encodedVocab}&language=de&limit=50&cache=0&offset=0&ancestors=`;

            fetch(url, { signal: controller.signal }).then((response) => {
                if (!response.ok) {
                    throw new Error(`request failed with status ${response.status} ${response.statusText}`);
                }
                return response.json();
            }).then((json) => {
                this.__options = this.__parseSearchResponse(json);
                this.__lastQuery = query;
                this.__lastVocab = vocab;
                this.__lastResults = this.__options;
                deferred.resolve(this.__options);
            }).catch((error) => {
                if (error.name === 'AbortError') {
                    // superseded by a newer keystroke - whatever request
                    // superseded us will resolve this.__optionsPromise instead
                    return;
                }
                console.error(`[NfisQuickEntryDanteSearchableSelect] failed to search vocab "${encodedVocab}"`, error);
                this.__options = [];
                // deliberately not cached - a failed fetch should be retried
                // next time, not "confirmed" as the empty-results answer
                deferred.resolve(this.__options);
            });
        }, 300);

        return this.__optionsPromise;
    }

    // resolves the label for the currently stored value directly, rather
    // than looking it up in getOptions() - that list is only ever whatever
    // the most recent search happened to return, which usually won't
    // contain the current value at all
    displayValue() {
        CUI.DataField.prototype.displayValue.call(this);

        const value = this.getValue();
        if (CUI.util.isNull(value)) {
            this.__input?.setValue(this._empty_text || '');
            return;
        }

        if (this.__selectedOption && CUI.util.isEqual(this.__selectedOption.value, value)) {
            this.__input?.setValue(this.__selectedOption.text);
            return;
        }

        this.__resolveLabelForValue(value).then((text) => {
            this.__selectedOption = { value, text: text || value };
            this.__input?.setValue(text || `${this._not_found_text} ${value}`);
        });
    }

    async __resolveLabelForValue(uri) {
        try {
            const properties = encodeURIComponent(this.__getProperties());
            const response = await fetch(`https://api.dante.gbv.de/data?cache=1&uri=${encodeURIComponent(uri)}&properties=${properties}`);
            if (!response.ok) {
                console.error(`[NfisQuickEntryDanteSearchableSelect] failed to resolve label for "${uri}": ${response.status} ${response.statusText}`);
                return null;
            }
            const json = await response.json();
            const jskos = json[0];
            if (!jskos) {
                return null;
            }
            return DANTEUtil.getConceptNameFromJSKOSObject(jskos, 'de', this._label_with_hierarchy);
        } catch (error) {
            console.error(`[NfisQuickEntryDanteSearchableSelect] failed to resolve label for "${uri}"`, error);
            return null;
        }
    }
}

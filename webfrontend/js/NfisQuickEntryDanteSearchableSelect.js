// A Dante-backed NfisQuickEntrySearchableSelect: instead of a pre-loaded
// options array, it searches the Dante API as the user types, by
// vocabulary name. Some Dante vocabularies have thousands of members (e.g.
// nld_gemarkung_niedersachsen has ~5400) and the API gives no usable total
// count and no working offset beyond roughly the first 1000 items, so
// pre-loading "all" options up front - what the base class, and CUI.Select,
// both expect - simply isn't possible for those. Searching server-side as
// the user types is the only option.
//
// Drop-in usage:
//   {
//       type: NfisQuickEntryDanteSearchableSelect,
//       name: "someField",
//       form: { label: "..." },
//       vocab: "nld_gemarkung_niedersachsen",
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
            }
        });
    }

    init() {
        super.init();
        this.__selectedOption = null;
        this.__debounceTimer = null;
        this.__abortController = null;
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

    // the Dante /suggest endpoint already filters server-side, on more than
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

    __parseSuggestResponse(json) {
        const texts = json?.[1];
        const uris = json?.[3];
        if (!Array.isArray(texts) || !Array.isArray(uris)) {
            return [];
        }
        return texts.map((text, idx) => ({ text, value: uris[idx] }));
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

        const deferred = new CUI.Deferred();
        this.__optionsPromise = deferred.promise();

        this.__debounceTimer = setTimeout(() => {
            const controller = new AbortController();
            this.__abortController = controller;

            const search = encodeURIComponent(this.__filterText.trim());
            const vocab = encodeURIComponent(this.__getVocab());
            const url = `https://api.dante.gbv.de/suggest?search=${search}&voc=${vocab}&language=de&limit=50&cache=0&ancestors=`;

            fetch(url, { signal: controller.signal }).then((response) => {
                if (!response.ok) {
                    throw new Error(`request failed with status ${response.status} ${response.statusText}`);
                }
                return response.json();
            }).then((json) => {
                this.__options = this.__parseSuggestResponse(json);
                deferred.resolve(this.__options);
            }).catch((error) => {
                if (error.name === 'AbortError') {
                    // superseded by a newer keystroke - whatever request
                    // superseded us will resolve this.__optionsPromise instead
                    return;
                }
                console.error(`[NfisQuickEntryDanteSearchableSelect] failed to load vocab "${vocab}"`, error);
                this.__options = [];
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
            const response = await fetch('https://api.dante.gbv.de/data?cache=1&uri=' + encodeURIComponent(uri) + '&properties=');
            if (!response.ok) {
                console.error(`[NfisQuickEntryDanteSearchableSelect] failed to resolve label for "${uri}": ${response.status} ${response.statusText}`);
                return null;
            }
            const json = await response.json();
            const jskos = json[0];
            if (!jskos) {
                return null;
            }
            return DANTEUtil.getConceptNameFromJSKOSObject(jskos, 'de');
        } catch (error) {
            console.error(`[NfisQuickEntryDanteSearchableSelect] failed to resolve label for "${uri}"`, error);
            return null;
        }
    }
}

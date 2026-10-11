// Bibliothèque enrichie d'AcademyCode (lot L8, 11/10/2026) : dessins originaux Codeurs en Herbe choisis au lot L7
// (bibliotheque-academycode/), servis à côté de l'éditeur (/editeur/static/bibliotheque-academycode.json, images
// dans /editeur/static/lib-assets/). Chargée seulement à l'ouverture d'une bibliothèque (rien au premier chargement).
// Les éléments d'origine restent EN TÊTE et inchangés (50 leçons les citent) ; nos six catégories remplacent celles
// de Scratch, et les éléments d'origine y sont rangés aussi (catalogue.existants).
import React from 'react';

export const URL_CATALOGUE = '/editeur/static/bibliotheque-academycode.json';

let promesse = null;

/**
 * @returns {Promise<?object>} catalogue {etiquettes, existants, sprites, backdrops, costumes}, ou null en cas d'échec
 */
export const chargerCatalogue = () => {
    if (!promesse) {
        promesse = fetch(URL_CATALOGUE, {credentials: 'same-origin'})
            .then(reponse => (reponse.ok ? reponse.json() : null))
            .catch(() => null)
            .then(cat => (cat && Array.isArray(cat.sprites) ? cat : null));
    }
    return promesse;
};

/** Pour les tests : oublie le catalogue déjà chargé. */
export const oublierCatalogue = () => {
    promesse = null;
};

/**
 * Éléments d'origine (étiquettes AcademyCode ajoutées), puis éléments du catalogue pour cette bibliothèque.
 * @param {Array} contenu - bibliothèque d'origine
 * @param {?object} cat - catalogue chargé
 * @param {string} cle - sprites, backdrops ou costumes
 * @returns {Array} données de la bibliothèque
 */
export const fusionner = (contenu, cat, cle) => {
    if (!cat) return contenu;
    const ranges = contenu.map(e => (cat.existants[e.name] ?
        {...e, tags: [...(e.tags ?? []), ...cat.existants[e.name]]} :
        e));
    return [...ranges, ...(cat[cle] ?? [])];
};

/**
 * Catégories AcademyCode présentes dans ces données, au format des boutons de scratch-gui.
 * @param {?object} cat - catalogue chargé
 * @param {Array} donnees - données fusionnées
 * @param {Array} tags - catégories d'origine (gardées tant que le catalogue n'est pas là)
 * @returns {Array} catégories
 */
export const categories = (cat, donnees, tags) => {
    if (!cat) return tags;
    const presentes = new Set(donnees.flatMap(e => e.tags ?? []));
    return Object.entries(cat.etiquettes)
        .filter(([tag]) => presentes.has(tag))
        .map(([tag, label]) => ({
            tag,
            intlLabel: {
                id: `gui.academycode.bibliotheque.${tag}`,
                defaultMessage: label,
                description: 'Catégorie AcademyCode'
            }
        }));
};

/**
 * Enveloppe un conteneur de bibliothèque : `data` et `tags` reçoivent le catalogue dès qu'il est chargé.
 * @param {string} cle - sprites, backdrops ou costumes
 * @param {Array} contenu - bibliothèque d'origine
 * @param {Array} tags - catégories d'origine
 * @returns {function} HOC
 */
export const avecBibliothequeAcademyCode = (cle, contenu, tags) => Enveloppe => {
    class AvecBibliotheque extends React.Component {
        constructor (props) {
            super(props);
            this.state = {cat: null};
        }
        componentDidMount () {
            this.vivant = true;
            chargerCatalogue().then(cat => {
                if (this.vivant && cat) this.setState({cat});
            });
        }
        componentWillUnmount () {
            this.vivant = false;
        }
        render () {
            const donnees = fusionner(contenu, this.state.cat, cle);
            return (
                <Enveloppe
                    {...this.props}
                    data={donnees}
                    tags={categories(this.state.cat, donnees, tags)}
                />
            );
        }
    }
    return AvecBibliotheque;
};

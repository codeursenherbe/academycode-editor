import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import VM from 'scratch-vm';

import costumeLibraryContent from '../lib/libraries/costumes.json';
import spriteTags from '../lib/libraries/sprite-tags';
import LibraryComponent from '../components/library/library.jsx';
import {avecBibliothequeEspace} from '../lib/academycode/bibliotheque-espace.jsx';

const messages = defineMessages({
    libraryTitle: {
        defaultMessage: 'Choose a Costume',
        description: 'Heading for the costume library',
        id: 'gui.costumeLibrary.chooseACostume'
    }
});


class CostumeLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleItemSelected'
        ]);
    }
    handleItemSelected (item) {
        const vmCostume = {
            name: item.name,
            rotationCenterX: item.rotationCenterX,
            rotationCenterY: item.rotationCenterY,
            bitmapResolution: item.bitmapResolution,
            skinId: null
        };
        this.props.vm.addCostumeFromLibrary(item.md5ext, vmCostume);
    }
    render () {
        return (
            <LibraryComponent
                data={this.props.data}
                id="costumeLibrary"
                tags={this.props.tags}
                title={this.props.intl.formatMessage(messages.libraryTitle)}
                onItemSelected={this.handleItemSelected}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

CostumeLibrary.propTypes = {
    data: PropTypes.arrayOf(PropTypes.object).isRequired,
    tags: PropTypes.arrayOf(PropTypes.object).isRequired,
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

// Mode Espace Animateur : les dessins Codeurs en Herbe en tête (sans effet pour AcademyCode).
export default avecBibliothequeEspace('costumes', costumeLibraryContent, spriteTags)(injectIntl(CostumeLibrary));

import DS from 'ember-data';
import OsfModel from './osf-model';

export default OsfModel.extend({
    name: DS.attr('string'),
    logo_path: DS.attr('string'),
    banner_path: DS.attr('string'),
    description: DS.attr('string'),

    // Relationships
    preprints: DS.hasMany('preprint', { inverse: 'provider', async: true }),
});

/*
  Base adapter class for all OSF APIv2 endpoints
 */
import Ember from 'ember';
import DS from 'ember-data';

import config from 'ember-get-config';
import DataAdapterMixin from 'ember-simple-auth/mixins/data-adapter-mixin';

export default DS.JSONAPIAdapter.extend(DataAdapterMixin, {
    authorizer: 'authorizer:osf-token',
    host: config.OSF.apiUrl,
    namespace: config.OSF.apiNamespace,
    buildURL() {
	// Fix issue where CORS request failed on 301s: Ember does not seem to append trailing
        // slash to URLs for single documents, but DRF redirects to force a trailing slash
	var url = this._super(...arguments);
	if (url.lastIndexOf('/') !== url.length - 1) {
            url += '/';
        }
        return url;
    },
    /**
     * Build the request payload for a relationship create/update. We're
     * using the meta hash of the relationship field to pass an optional
     * custom serialization method. This bypasses the normal serialization
     * flow, but is necessary to cooperate with the OSF APIv2.
     *
     * @method _buildRelationshipPayload
     * @param {DS.Store} store
     * @param {DS.Snapshot} snapshot
     * @param {String} relationship the relationship to build a payload for
     * @return {Object} the serialized relationship
     **/
    _relationshipPayload(store, snapshot, relationship) {
        var relationMeta = snapshot.record[relationship].meta();
        var relationType = relationMeta.type;
        var serialized;
        if (relationMeta.options.serializer) {
            serialized = relationMeta.options.serializer(snapshot.record);
        } else {
            var serializer = store.serializerFor(relationType);
            var toBeSent = snapshot.record.get(relationship).filter(record => record.id === null);
	    if (!toBeSent) {
		// TODO console.log ?
	    }
            serialized = serializer.serialize(toBeSent);

            // for some reason this is not hitting the node overloaded serialize method
            // delete serialized.data.relationships;
        }
        return serialized;
    },
    /**
     * Construct a URL for a relationship create/update/delete. Has the same
     * signature as buildURL, with the addition of a 'relationship' param
     *
     * @method _buildRelationshipURL
     * @param {String} relationship the relationship to build a url for
     * @return {String} a URL
     **/
    _buildRelationshipURL() {
	var [,, snapshot,,, relationship] = arguments;
        var links = relationship ? snapshot.record.get(
            `links.relationships.${Ember.String.underscore(relationship)}.links`
        ) : false;
        if (links) {
            return links.self ? links.self.href : links.related.href;
        } else {
            return this.buildURL(...arguments);
        }
    },
    updateRecord(store, type, snapshot, _, query) {
	var promises = [];

        var dirtyRelationships = snapshot.record.get('dirtyRelationships');
        if (dirtyRelationships.length) {
	    promises = promises.concat(dirtyRelationships.map(relationship => {
		var url = this._buildRelationshipURL(type.modelName, snapshot.id, snapshot, 'updateRecord', query, relationship);
		var requestType = snapshot.record[relationship].meta().options.updateRequestType;
		return this.ajax(url, requestType || 'PATCH', {
		    data: this._relationshipPayload(store, snapshot, relationship)
		}).then(() => snapshot.record.clearDirtyRelationship(relationship));
	    }));	
        }
	if (snapshot.record.get('hasDirtyAttributes')) {
	    promises.push(this._super(...arguments));
        }
	return Ember.Promise.all(promises);
    }
});

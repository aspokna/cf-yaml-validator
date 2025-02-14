/**
 * Defines the build step schema
 */

'use strict';

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
const _ = require('lodash');

const Joi = require('joi');
const BaseSchema = require('./../base-schema');
const registryValidation = require('../validations/registry');
const imageNameValidation = require('../validations/image-name');

const BUILD_VERSION = 'V2';
const PROVIDERS = ['cf', 'gcb'];

class Build extends BaseSchema {
    //------------------------------------------------------------------------------
    // Public Interface
    //------------------------------------------------------------------------------

    static getType() {
        return 'build';
    }

    getSchema(opts = {}) {
        const buildProperties = {
            type: Joi.string().valid(Build.getType()),
            working_directory: Joi.string(),
            dockerfile: Joi.alternatives()
                .try(Joi.string(), Joi.object({ content: Joi.string() })),
            no_cache: Joi.boolean(),
            no_cf_cache: Joi.boolean(),
            squash: Joi.boolean(),
            image_name: Joi.string().required(),
            build_arguments: Joi.array().items(Joi.string()),
            tag: opts.tagIsRequired ? Joi.string().required() : Joi.string(),
            ...(opts.buildVersion === BUILD_VERSION && { tags: Joi.array().items(Joi.string()) }),
            metadata: Joi.object({
                set: BaseSchema._getMetadataAnnotationSetSchema()
            }),
            annotations: BaseSchema._getAnnotationsSchema(),
            target: Joi.string(),
            ssh: BaseSchema._getSshSchema(),
            secrets: BaseSchema._getSecretsSchema(),
            progress: Joi.string(),
            buildkit: Joi.boolean(),
            ...(opts.buildVersion === BUILD_VERSION && { registry: Joi.string() }),
            ...(opts.buildVersion === BUILD_VERSION && { disable_push: Joi.boolean() }),
            provider: Build._getProviderSchema(),
            registry_contexts: Joi.array().items(Joi.string()),
        };
        return this._createSchema(buildProperties);
    }

    static _getProviderSchema() {
        return Joi.object({
            type: Joi.string().valid(PROVIDERS),
            arguments: Joi.when('type', {
                is: 'gcb',
                then: Joi.object({
                    google_app_creds: Joi.string(),
                    cache: Joi.object({
                        repo: Joi.string().required(),
                        ttl: Joi.string()
                    }).required(),
                    timeout: Joi.string(),
                    machineType: Joi.string().valid(
                        'UNSPECIFIED',
                        'N1_HIGHCPU_8',
                        'N1_HIGHCPU_32'
                    ),
                    diskSizeGb: Joi.number(),
                    logsBucket: Joi.string()
                })
            })
        });
    }

    static validateStep(step, yaml, name, context) {
        const registryValidationResult = registryValidation.validate(step,
            yaml,
            name,
            context,
            { handleIfNoRegistriesOnAccount: false, handleIfNoRegistryExcplicitlyDefined: false, handleCFCRRemovalUseCase: true });

        const argumentsValidationResult = this.validateArguments(step, yaml, name);
        return _.mergeWith(registryValidationResult, argumentsValidationResult, this._mergeCustomizer);
    }

    static _mergeCustomizer(objValue, srcValue) {
        if (_.isArray(objValue)) {
            return objValue.concat(srcValue);
        }

        return objValue;
    }

    static validateArguments(step, yaml, name) {
        const validations = [imageNameValidation];

        return validations.reduce((acc, curr) => {
            const result = curr.validate(step, yaml, name);

            return _.mergeWith(acc, result, this._mergeCustomizer);
        }, { errors: [], warnings: [] });
    }

    _applyStepCompatibility(schema) {
        return schema.rename('working-directory', 'working_directory', { ignoreUndefined: true })
            .rename('image-name', 'image_name', { ignoreUndefined: true })
            .rename('build-arguments', 'build_arguments', { ignoreUndefined: true });
    }
}
// Exported objects/methods
Build.BUILD_VERSION = BUILD_VERSION;
Build.PROVIDERS = PROVIDERS;
module.exports = Build;

import { bool, number, object, string } from "yup"
import { contentTypesSchema } from "../../DB/models/Leaf"

export const leafPostSchema = object().required().shape({
    treeNodeId: string().objectIdString().required().label('Tree node id'),
    title: string().required().label('Title'),
})

export const leafGetSchema = object().required().shape({
    parentTreeNodeId: string().objectIdString().label('Parent tree node id').when('leafId', {
        is: (leafId: any) => !leafId || leafId === null || leafId === undefined,
        then(schema) {
            return schema.required()
        },
        otherwise(schema) {
            return schema.notRequired()
        },
    }),
    leafId: string().objectIdString().label('Leaf id').when('parentTreeNodeId', {
        is: (parentTreeNodeId: any) => !parentTreeNodeId || parentTreeNodeId === null || parentTreeNodeId === undefined,
        then(schema) {
            return schema.required()
        },
        otherwise(schema) {
            return schema.notRequired()
        },
    }),
}, [['parentTreeNodeId', 'leafId']])

export const leafListSchema = object().required().shape({
    parentId: string().objectIdString().required().objectIdString().label('Parent folder id'),
    search: string().optional().label('Search input'),
    limit: number().required().integer().min(0).max(100).label('Limit'),
    skip: number().optional().integer().min(0).label('Skip').default(0),
})

export const leafContentAddSchema = object().required().shape({
    leafId: string().objectIdString().required().label('Leaf id'),
    type: contentTypesSchema.required(),
    isTerm: bool().required(),
    atIndex: number().optional().integer().min(0),
})

export const leafContentValueAddSchema = object().required().shape({
    leafId: string().objectIdString().required().label('Leaf id'),
    type: contentTypesSchema.required().label('Type'),
    isTerm: bool().required(),
    atContentIndex: number().required().integer().min(0),
    value: string().required(),
    atContentValueIndex: number().optional().integer().min(0),
})

export const leafContentValueDeleteSchema = object().required().shape({
    leafId: string().objectIdString().required().label('Leaf id'),
    type: contentTypesSchema.required().label('Type'),
    isTerm: bool().required(),
    atContentIndex: number().required().integer().min(0),
    value: string().required(),
    atContentValueIndex: number().required().integer().min(0),
})

export const leafUpdateSchema = object().required().shape({
    leafId: string().objectIdString().required().label('Leaf id'),
    title: string().required().label('Title')
})

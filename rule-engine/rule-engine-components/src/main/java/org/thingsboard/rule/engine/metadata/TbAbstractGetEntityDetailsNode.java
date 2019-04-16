/**
 * Copyright © 2016-2019 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.thingsboard.rule.engine.metadata;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.thingsboard.rule.engine.api.TbContext;
import org.thingsboard.rule.engine.api.TbNode;
import org.thingsboard.rule.engine.api.TbNodeConfiguration;
import org.thingsboard.rule.engine.api.TbNodeException;
import org.thingsboard.rule.engine.util.EntityDetails;
import org.thingsboard.server.common.data.ContactBased;
import org.thingsboard.server.common.msg.TbMsg;
import org.thingsboard.server.common.msg.TbMsgMetaData;

import java.lang.reflect.Type;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.thingsboard.rule.engine.api.TbRelationTypes.SUCCESS;

@Slf4j
public abstract class TbAbstractGetEntityDetailsNode<C extends TbAbstractGetEntityDetailsNodeConfiguration> implements TbNode {

    private static final Gson gson = new Gson();
    private static final JsonParser jsonParser = new JsonParser();
    private static final Type TYPE = new TypeToken<Map<String, String>>() {}.getType();

    protected C config;

    @Override
    public void init(TbContext ctx, TbNodeConfiguration configuration) throws TbNodeException {
        this.config = loadGetEntityDetailsNodeConfiguration(configuration);
    }

    @Override
    public void onMsg(TbContext ctx, TbMsg msg) {
        try {
            ctx.tellNext(getDetails(ctx, msg), SUCCESS);
        } catch (Exception e) {
            ctx.tellFailure(msg, e);
        }
    }

    @Override
    public void destroy() {}

    protected abstract C loadGetEntityDetailsNodeConfiguration(TbNodeConfiguration configuration) throws TbNodeException;

    protected abstract TbMsg getDetails(TbContext ctx, TbMsg msg);

    protected MessageData getDataAsJson(TbMsg msg) {
        if (this.config.isAddToMetadata()) {
            return new MessageData(gson.toJsonTree(msg.getMetaData().getData(), TYPE), "metadata");
        } else {
            return new MessageData(jsonParser.parse(msg.getData()), "data");
        }
    }

    protected TbMsg transformMsg(TbContext ctx, TbMsg msg, JsonElement resultObject, MessageData messageData) {
        if (messageData.getDataType().equals("metadata")) {
            Map<String, String> metadataMap = gson.fromJson(resultObject.toString(), TYPE);
            return ctx.transformMsg(msg, msg.getType(), msg.getOriginator(), new TbMsgMetaData(metadataMap), msg.getData());
        } else {
            return ctx.transformMsg(msg, msg.getType(), msg.getOriginator(), msg.getMetaData(), gson.toJson(resultObject));
        }
    }

    protected JsonElement addContactProperties(JsonElement data, ContactBased entity, EntityDetails entityDetails, String prefix) {
        JsonObject dataAsObject = data.getAsJsonObject();
        switch (entityDetails) {
            case ADDRESS:
                if (entity.getAddress() != null)
                    dataAsObject.addProperty(prefix + "address", entity.getAddress());
                break;
            case ADDRESS2:
                if (entity.getAddress2() != null)
                    dataAsObject.addProperty(prefix + "address2", entity.getAddress2());
                break;
            case CITY:
                if (entity.getCity() != null) dataAsObject.addProperty(prefix + "city", entity.getCity());
                break;
            case COUNTRY:
                if (entity.getCountry() != null)
                    dataAsObject.addProperty(prefix + "country", entity.getCountry());
                break;
            case STATE:
                if (entity.getState() != null) dataAsObject.addProperty(prefix + "state", entity.getState());
                break;
            case EMAIL:
                if (entity.getEmail() != null) dataAsObject.addProperty(prefix + "email", entity.getEmail());
                break;
            case PHONE:
                if (entity.getPhone() != null) dataAsObject.addProperty(prefix + "phone", entity.getPhone());
                break;
            case ZIP:
                if (entity.getZip() != null) dataAsObject.addProperty(prefix + "zip", entity.getZip());
                break;
            case ADDITIONAL_INFO:
                if (entity.getAdditionalInfo().hasNonNull("description")) {
                    dataAsObject.addProperty(prefix + "additionalInfo", entity.getAdditionalInfo().get("description").asText());
                }
                break;
        }
        return dataAsObject;
    }

    @Data
    @AllArgsConstructor
    protected static class MessageData {
        private JsonElement data;
        private String dataType;
    }


}